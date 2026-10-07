package com.armakers3d.payments.service;

import com.armakers3d.payments.domain.ProofImageType;
import com.armakers3d.payments.service.exception.InvalidProofImageException;
import com.armakers3d.payments.service.exception.UnsupportedProofImageTypeException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Decides what an uploaded proof REALLY is (ADR-005, security of uploads). Pure and stateless. The client's
 * Content-Type and filename are never consulted: the type comes from the magic bytes, then the container structure
 * is checked cheaply (header dimensions, proper end of file, no trailing data) without decoding pixels, so
 * truncated, zero-size, oversized-canvas and polyglot files (valid image header followed by HTML/script/other
 * payload) are refused. Accepted: JPEG, PNG, WebP. Everything else (SVG, HTML, PDF, GIF, HEIC, executables) is
 * {@link UnsupportedProofImageTypeException}.
 *
 * <p>Metadata (EXIF, GPS, text chunks) is NOT stripped: re-encoding would change the bytes and cannot be done for
 * WebP with the JDK alone. Proofs are therefore only served to their owner and to administrators (ADR-005).
 */
public final class ProofImageInspector {

    /** Smallest side accepted: a real payment screenshot is never this small. */
    static final int MIN_SIDE = 32;
    /** Largest side and pixel count accepted (protects whoever decodes the image later). */
    static final int MAX_SIDE = 12_000;
    static final long MAX_PIXELS = 50_000_000L;

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] PNG_IEND = {0, 0, 0, 0, 'I', 'E', 'N', 'D', (byte) 0xAE, 0x42, 0x60, (byte) 0x82};
    /** Case-insensitive markers (6+ bytes, so a random false positive is negligible) of an embedded script/markup payload. */
    private static final String[] MARKUP = {"<script", "<iframe", "<!doctype", "<html>", "<svg xmlns"};

    /** Result of a successful inspection. */
    public record Inspected(ProofImageType type, int width, int height, String sha256) {}

    public Inspected inspect(byte[] content) {
        if (content == null || content.length == 0) {
            throw new InvalidProofImageException("The uploaded file is empty.");
        }
        ProofImageType type = detect(content);
        int[] size = switch (type) {
            case JPEG -> jpegSize(content);
            case PNG -> pngSize(content);
            case WEBP -> webpSize(content);
        };
        int width = size[0];
        int height = size[1];
        if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE
                || (long) width * height > MAX_PIXELS) {
            throw new InvalidProofImageException("The image dimensions are not valid.");
        }
        if (containsMarkup(content)) {
            throw new InvalidProofImageException("The file contains embedded non-image content.");
        }
        return new Inspected(type, width, height, sha256(content));
    }

    // ---------- detection ----------

    static ProofImageType detect(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return ProofImageType.JPEG;
        }
        if (startsWith(b, PNG_MAGIC)) {
            return ProofImageType.PNG;
        }
        if (b.length >= 12 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) {
            return ProofImageType.WEBP;
        }
        throw new UnsupportedProofImageTypeException();
    }

    // ---------- JPEG: walk the marker segments up to the first SOF; the file must end with EOI ----------

    private static int[] jpegSize(byte[] b) {
        int end = b.length;
        int zeros = 0;
        while (end > 2 && b[end - 1] == 0 && zeros < 64) { // tolerate a little zero padding after EOI
            end--;
            zeros++;
        }
        if ((b[end - 2] & 0xFF) != 0xFF || (b[end - 1] & 0xFF) != 0xD9) {
            throw new InvalidProofImageException("The image is truncated or has trailing data.");
        }
        int i = 2;
        while (i + 3 < b.length) {
            if ((b[i] & 0xFF) != 0xFF) {
                throw new InvalidProofImageException("The image is corrupt.");
            }
            int marker = b[i + 1] & 0xFF;
            if (marker == 0xFF) { // fill byte
                i++;
                continue;
            }
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { // standalone markers
                i += 2;
                continue;
            }
            if (marker == 0xD9 || marker == 0xDA) { // EOI or start of scan before any frame header
                throw new InvalidProofImageException("The image is corrupt.");
            }
            int length = u16be(b, i + 2);
            if (length < 2 || i + 2 + length > b.length) {
                throw new InvalidProofImageException("The image is truncated.");
            }
            boolean sof = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (sof) {
                if (length < 8) {
                    throw new InvalidProofImageException("The image is corrupt.");
                }
                return new int[] {u16be(b, i + 7), u16be(b, i + 5)};
            }
            i += 2 + length;
        }
        throw new InvalidProofImageException("The image is corrupt.");
    }

    // ---------- PNG: IHDR first, IEND last, nothing after it ----------

    private static int[] pngSize(byte[] b) {
        if (b.length < 8 + 25 + PNG_IEND.length) {
            throw new InvalidProofImageException("The image is truncated.");
        }
        if (u32be(b, 8) != 13 || !ascii(b, 12, "IHDR")) {
            throw new InvalidProofImageException("The image is corrupt.");
        }
        for (int k = 0; k < PNG_IEND.length; k++) {
            if (b[b.length - PNG_IEND.length + k] != PNG_IEND[k]) {
                throw new InvalidProofImageException("The image is truncated or has trailing data.");
            }
        }
        long width = u32be(b, 16);
        long height = u32be(b, 20);
        if (width > Integer.MAX_VALUE || height > Integer.MAX_VALUE) {
            throw new InvalidProofImageException("The image dimensions are not valid.");
        }
        return new int[] {(int) width, (int) height};
    }

    // ---------- WebP: RIFF size must match the file; first chunk gives the canvas size ----------

    private static int[] webpSize(byte[] b) {
        if (b.length < 25) {
            throw new InvalidProofImageException("The image is truncated.");
        }
        long riffSize = u32le(b, 4);
        if (riffSize + 8 != b.length) {
            throw new InvalidProofImageException("The image is truncated or has trailing data.");
        }
        long chunkSize = u32le(b, 16);
        if (20 + chunkSize > b.length) {
            throw new InvalidProofImageException("The image is truncated.");
        }
        if (ascii(b, 12, "VP8X")) {
            requireLength(b, 30);
            return new int[] {1 + u24le(b, 24), 1 + u24le(b, 27)};
        }
        if (ascii(b, 12, "VP8L")) {
            if ((b[20] & 0xFF) != 0x2F) {
                throw new InvalidProofImageException("The image is corrupt.");
            }
            long bits = u32le(b, 21);
            return new int[] {(int) (bits & 0x3FFF) + 1, (int) ((bits >> 14) & 0x3FFF) + 1};
        }
        if (ascii(b, 12, "VP8 ")) {
            requireLength(b, 30);
            if ((b[23] & 0xFF) != 0x9D || (b[24] & 0xFF) != 0x01 || (b[25] & 0xFF) != 0x2A) {
                throw new InvalidProofImageException("The image is corrupt.");
            }
            return new int[] {(b[26] & 0xFF | (b[27] & 0xFF) << 8) & 0x3FFF, (b[28] & 0xFF | (b[29] & 0xFF) << 8) & 0x3FFF};
        }
        throw new InvalidProofImageException("The image is corrupt.");
    }

    private static void requireLength(byte[] b, int min) {
        if (b.length < min) {
            throw new InvalidProofImageException("The image is truncated.");
        }
    }

    // ---------- helpers ----------

    private static boolean containsMarkup(byte[] b) {
        for (int i = 0; i < b.length; i++) {
            if (b[i] != '<') {
                continue;
            }
            for (String marker : MARKUP) {
                if (matchesIgnoreCase(b, i, marker)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean matchesIgnoreCase(byte[] b, int at, String marker) {
        if (at + marker.length() > b.length) {
            return false;
        }
        for (int k = 0; k < marker.length(); k++) {
            int c = b[at + k];
            if (c >= 'A' && c <= 'Z') {
                c += 'a' - 'A';
            }
            if (c != marker.charAt(k)) {
                return false;
            }
        }
        return true;
    }

    private static boolean startsWith(byte[] b, byte[] prefix) {
        if (b.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean ascii(byte[] b, int at, String text) {
        byte[] expected = text.getBytes(StandardCharsets.US_ASCII);
        if (at + expected.length > b.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if (b[at + i] != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private static int u16be(byte[] b, int at) {
        return (b[at] & 0xFF) << 8 | (b[at + 1] & 0xFF);
    }

    private static long u32be(byte[] b, int at) {
        return ((long) (b[at] & 0xFF) << 24) | ((b[at + 1] & 0xFF) << 16) | ((b[at + 2] & 0xFF) << 8) | (b[at + 3] & 0xFF);
    }

    private static int u24le(byte[] b, int at) {
        return (b[at] & 0xFF) | (b[at + 1] & 0xFF) << 8 | (b[at + 2] & 0xFF) << 16;
    }

    private static long u32le(byte[] b, int at) {
        return ((long) (b[at + 3] & 0xFF) << 24) | ((b[at + 2] & 0xFF) << 16) | ((b[at + 1] & 0xFF) << 8) | (b[at] & 0xFF);
    }

    static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }
}
