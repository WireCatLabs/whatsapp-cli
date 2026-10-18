package main

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"io"
)

// thumbnailSide is the longer side of the preview, as mautrix-whatsapp makes it (pkg/msgconv/thumbnail.go,
// thumbnailMaxSize): the recipient's app shows it blurred until the photo downloads.
const thumbnailSide = 72

// thumbnailPixels caps the photos decoded for a preview: a decoded picture takes four bytes a pixel, so a huge one
// would cost hundreds of megabytes for a 72-pixel preview. Above it the photo goes without one.
const thumbnailPixels = 25_000_000

// thumbnailOf makes the inline JPEG preview of a photo, or nil: a photo the standard library cannot decode (WebP)
// still goes, without a preview.
func thumbnailOf(r io.ReadSeeker, config image.Config) []byte {
	if config.Width <= 0 || config.Height <= 0 || config.Width*config.Height > thumbnailPixels {
		return nil
	}
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return nil
	}
	img, _, err := image.Decode(r)
	if err != nil {
		return nil
	}
	return thumbnail(img)
}

func thumbnail(img image.Image) []byte {
	b := img.Bounds()
	w, h := fit(b.Dx(), b.Dy())
	small := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			cell := image.Rect(b.Min.X+x*b.Dx()/w, b.Min.Y+y*b.Dy()/h, b.Min.X+(x+1)*b.Dx()/w, b.Min.Y+(y+1)*b.Dy()/h)
			small.Set(x, y, average(img, cell))
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, small, &jpeg.Options{Quality: jpeg.DefaultQuality}); err != nil {
		return nil
	}
	return out.Bytes()
}

func fit(w, h int) (int, int) {
	switch {
	case w <= thumbnailSide && h <= thumbnailSide:
		return w, h
	case w >= h:
		return thumbnailSide, max(h*thumbnailSide/w, 1)
	default:
		return max(w*thumbnailSide/h, 1), thumbnailSide
	}
}

// average samples a few points of the cell rather than every pixel, and lays transparency over white: JPEG has no
// alpha, and a transparent PNG would otherwise turn black.
func average(img image.Image, cell image.Rectangle) color.Color {
	stepX, stepY := max(cell.Dx()/4, 1), max(cell.Dy()/4, 1)
	var r, g, b, n uint32
	for y := cell.Min.Y; y < cell.Max.Y; y += stepY {
		for x := cell.Min.X; x < cell.Max.X; x += stepX {
			cr, cg, cb, ca := img.At(x, y).RGBA()
			r, g, b, n = r+cr+0xffff-ca, g+cg+0xffff-ca, b+cb+0xffff-ca, n+1
		}
	}
	return color.RGBA64{R: uint16(r / n), G: uint16(g / n), B: uint16(b / n), A: 0xffff}
}
