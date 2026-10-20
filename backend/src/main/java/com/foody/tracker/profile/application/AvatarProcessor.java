package com.foody.tracker.profile.application;

import com.foody.tracker.shared.api.ApiException;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AvatarProcessor {
    public static final int MAX_BYTES = 2 * 1024 * 1024;

    public byte[] process(byte[] input) {
        if (input.length == 0 || input.length > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "AVATAR_TOO_LARGE", "Escolha uma imagem de até 2 MB.");
        }
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalidImage();
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!format.equals("png") && !format.equals("jpeg")) throw invalidImage();
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 8_000_000) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AVATAR_DIMENSIONS", "Use uma imagem de até 4096 px por lado e 8 megapixels.");
                }
                var source = reader.read(0);
                var target = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
                var graphics = target.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                    int side = Math.min(width, height), x = (width - side) / 2, y = (height - side) / 2;
                    graphics.drawImage(source, 0, 0, 256, 256, x, y, x + side, y + side, null);
                } finally { graphics.dispose(); }
                var output = new ByteArrayOutputStream();
                ImageIO.write(target, "png", output); // Re-encode without the uploaded file's metadata.
                return output.toByteArray();
            } finally { reader.dispose(); }
        } catch (IOException exception) { throw invalidImage(); }
    }

    private ApiException invalidImage() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "INVALID_AVATAR", "Envie uma imagem PNG ou JPEG válida.");
    }
}
