package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.payments.domain.ProofImageType;
import com.armakers3d.payments.service.ProofImageInspector;
import com.armakers3d.payments.service.exception.InvalidProofImageException;
import com.armakers3d.payments.service.exception.UnsupportedProofImageTypeException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/** Magic-byte detection and cheap structural checks of uploaded payment proofs (no Spring, no decoding of pixels). */
class ProofImageInspectorTest {

    private final ProofImageInspector inspector = new ProofImageInspector();

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void validJpegPngAndWebpAreAcceptedWithTheirRealDimensions() throws IOException {
        var jpeg = inspector.inspect(TestImages.jpeg(120, 80, 1));
        assertThat(jpeg.type()).isEqualTo(ProofImageType.JPEG);
        assertThat(jpeg.width()).isEqualTo(120);
        assertThat(jpeg.height()).isEqualTo(80);
        assertThat(jpeg.sha256()).hasSize(64);

        var png = inspector.inspect(TestImages.png(64, 200, 2));
        assertThat(png.type()).isEqualTo(ProofImageType.PNG);
        assertThat(png.width()).isEqualTo(64);
        assertThat(png.height()).isEqualTo(200);

        var webp = inspector.inspect(TestImages.webp(300, 500));
        assertThat(webp.type()).isEqualTo(ProofImageType.WEBP);
        assertThat(webp.width()).isEqualTo(300);
        assertThat(webp.height()).isEqualTo(500);
    }

    @Test
    void theSameBytesGiveTheSameHashAndDifferentBytesDoNot() throws IOException {
        assertThat(inspector.inspect(TestImages.png(64, 64, 5)).sha256()).isEqualTo(inspector.inspect(TestImages.png(64, 64, 5)).sha256());
        assertThat(inspector.inspect(TestImages.png(64, 64, 5)).sha256()).isNotEqualTo(inspector.inspect(TestImages.png(64, 64, 6)).sha256());
    }

    @Test
    void formatsThatAreNotJpegPngOrWebpAreUnsupportedWhateverTheirExtension() {
        byte[][] rejected = {
            ascii("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\"></svg>"),
            ascii("<html><body><script>alert(1)</script></body></html>"),
            ascii("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"),
            ascii("GIF89a@\u0000@\u0000\u0000\u0000\u0000;"),
            concatAll(new byte[] {0, 0, 0, 0x18}, ascii("ftypheic"), new byte[40]), // HEIC
            concatAll(ascii("MZ"), new byte[200]), // Windows executable
            concatAll(new byte[] {0x7F}, ascii("ELF"), new byte[200]), // Linux executable
            ascii("PK\u0003\u0004 zip"),
            ascii("just some text pretending to be a picture"),
        };
        for (byte[] content : rejected) {
            assertThatThrownBy(() -> inspector.inspect(content)).isInstanceOf(UnsupportedProofImageTypeException.class);
        }
    }

    @Test
    void emptyAndNullAreInvalid() {
        assertThatThrownBy(() -> inspector.inspect(new byte[0])).isInstanceOf(InvalidProofImageException.class);
        assertThatThrownBy(() -> inspector.inspect(null)).isInstanceOf(InvalidProofImageException.class);
    }

    @Test
    void truncatedImagesAreInvalid() throws IOException {
        byte[] jpeg = TestImages.jpeg(64, 64, 1);
        byte[] png = TestImages.png(64, 64, 1);
        byte[] webp = TestImages.webp(64, 64);
        for (byte[] full : new byte[][] {jpeg, png, webp}) {
            byte[] half = Arrays.copyOf(full, full.length / 2);
            assertThatThrownBy(() -> inspector.inspect(half)).isInstanceOf(InvalidProofImageException.class);
        }
        // header only
        assertThatThrownBy(() -> inspector.inspect(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})).isInstanceOf(InvalidProofImageException.class);
        assertThatThrownBy(() -> inspector.inspect(Arrays.copyOf(png, 8))).isInstanceOf(InvalidProofImageException.class);
    }

    @Test
    void zeroTinyAndAbsurdDimensionsAreInvalid() throws IOException {
        assertThatThrownBy(() -> inspector.inspect(TestImages.png(1, 1, 1))).isInstanceOf(InvalidProofImageException.class);
        assertThatThrownBy(() -> inspector.inspect(TestImages.webp(31, 500))).isInstanceOf(InvalidProofImageException.class);
        // PNG whose IHDR claims 0 x 0
        byte[] zero = TestImages.png(64, 64, 3);
        for (int i = 16; i < 24; i++) {
            zero[i] = 0;
        }
        assertThatThrownBy(() -> inspector.inspect(zero)).isInstanceOf(InvalidProofImageException.class);
        // PNG claiming 100000 x 100000
        byte[] huge = TestImages.png(64, 64, 3);
        for (int offset : new int[] {16, 20}) { // 100000 = 0x000186A0 for width and height
            huge[offset] = 0;
            huge[offset + 1] = 0x01;
            huge[offset + 2] = (byte) 0x86;
            huge[offset + 3] = (byte) 0xA0;
        }
        assertThatThrownBy(() -> inspector.inspect(huge)).isInstanceOf(InvalidProofImageException.class);
    }

    @Test
    void polyglotsWithTrailingOrEmbeddedMarkupAreInvalid() throws IOException {
        byte[] script = ascii("<script>alert(document.cookie)</script>");
        for (byte[] image : new byte[][] {TestImages.jpeg(64, 64, 1), TestImages.png(64, 64, 1), TestImages.webp(64, 64)}) {
            assertThatThrownBy(() -> inspector.inspect(TestImages.concat(image, script))).isInstanceOf(InvalidProofImageException.class);
            assertThatThrownBy(() -> inspector.inspect(TestImages.concat(image, ascii("MZ" + "x".repeat(100)))))
                    .isInstanceOf(InvalidProofImageException.class);
        }
        // markup hidden INSIDE a structurally valid file (before the end marker) is also refused
        byte[] png = TestImages.png(64, 64, 1);
        byte[] injected = png.clone();
        byte[] marker = ascii("<script>");
        System.arraycopy(marker, 0, injected, 40, marker.length);
        assertThatThrownBy(() -> inspector.inspect(injected)).isInstanceOf(InvalidProofImageException.class);
    }

    private static byte[] concatAll(byte[]... parts) {
        byte[] out = new byte[0];
        for (byte[] p : parts) {
            out = TestImages.concat(out, p);
        }
        return out;
    }
}
