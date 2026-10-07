package com.armakers3d.payments;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;

/** Tiny valid JPEG/PNG/WebP generators for the payment proof tests (equal seeds give identical bytes). */
final class TestImages {

    private TestImages() {}

    static byte[] jpeg(int width, int height, int seed) throws IOException {
        return encode(width, height, seed, "jpg");
    }

    static byte[] png(int width, int height, int seed) throws IOException {
        return encode(width, height, seed, "png");
    }

    private static byte[] encode(int width, int height, int seed, String format) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                image.setRGB(x, y, (int) ((seed * 2654435761L + x * 31L + y * 17L) & 0xFFFFFF));
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, out)) {
            throw new IllegalStateException("No writer for " + format);
        }
        return out.toByteArray();
    }

    /** A structurally valid lossless WebP (RIFF + VP8L header with the given canvas size; payload is filler). */
    static byte[] webp(int width, int height) {
        int chunkSize = 16;
        ByteBuffer b = ByteBuffer.allocate(8 + 4 + 8 + chunkSize).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        b.putInt(4 + 8 + chunkSize);
        b.put("WEBP".getBytes(StandardCharsets.US_ASCII));
        b.put("VP8L".getBytes(StandardCharsets.US_ASCII));
        b.putInt(chunkSize);
        b.put((byte) 0x2F);
        b.putInt((width - 1) | ((height - 1) << 14));
        return b.array();
    }

    static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }
}
