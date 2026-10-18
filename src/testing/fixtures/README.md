# Test fixtures

## `tone.ogg`

One second of a 440 Hz sine tone as Ogg Opus, for the voice notes the fake engine downloads in
`src/media.test.ts`. A speech model needs real Ogg Opus to decode; the test hands in its own recognizer.

```sh
ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 48000 -c:a libopus -b:a 16k \
  -map_metadata -1 -fflags +bitexact -flags:a +bitexact tone.ogg
```
