"""Synthesise an original, gentle ambient piano/pad bed for the invitation video (32 s: 6 s envelope intro + 26 s invitation).
Pure Python (no numpy). Output: assets/music_dry.wav -> ffmpeg adds reverb -> assets/music.m4a
"""
import math, struct, wave, sys, os

SR = 44100
DUR = 32.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N

def hz(m):  # midi -> Hz
    return 440.0 * 2 ** ((m - 69) / 12)

# chord per scene (start, end, pad notes, arpeggio notes)
CH = [
    (0.0, 6.0,  [41, 53, 60, 65],     []),                          # envelope intro: soft F pad only
    (6.0, 11.0, [41, 53, 57, 60, 64], [65, 69, 72, 76, 72, 69]),   # Fmaj7
    (11.0, 17.0,[40, 52, 55, 60, 67], [64, 67, 72, 74, 72, 67]),   # C/E
    (17.0, 22.0,[38, 50, 57, 60, 65], [62, 65, 69, 72, 69, 65]),   # Dm7
    (22.0, 27.0,[34, 46, 53, 57, 62], [62, 65, 69, 74, 69, 65]),   # Bbmaj7
    (27.0, 32.0,[41, 53, 60, 67, 69], [65, 67, 69, 72, 77, 72]),   # Fadd9
]

def add(i0, samples_l, samples_r):
    pass

# --- pad ---
for (s, e, pad, _) in CH:
    a, b = int(s * SR), min(N, int((e + 1.2) * SR))
    for m in pad:
        f = hz(m)
        f2 = f * 1.003
        amp = 0.045 if m > 45 else 0.06
        pan = 0.5 + 0.25 * math.sin(m)
        for i in range(a, b):
            t = (i - a) / SR
            env = min(1.0, t / 1.4) * (1.0 if i < e * SR else max(0.0, 1 - (i / SR - e) / 1.2))
            v = amp * env * (math.sin(2 * math.pi * f * t) + 0.6 * math.sin(2 * math.pi * f2 * t) + 0.15 * math.sin(4 * math.pi * f * t))
            L[i] += v * (1 - pan) * 1.4
            R[i] += v * pan * 1.4

# --- piano-like arpeggio (8th notes) ---
step = 0.42
for (s, e, _, arp) in CH:
    k = 0
    t0 = s + 0.15
    while arp and t0 < e - 0.05 and t0 < DUR - 1.5:
        m = arp[k % len(arp)]
        f = hz(m)
        a = int(t0 * SR)
        b = min(N, a + int(3.2 * SR))
        vel = 0.10 if k % 3 == 0 else 0.075
        pan = 0.35 + 0.3 * ((k % 4) / 3)
        for i in range(a, b):
            t = (i - a) / SR
            env = min(1.0, t / 0.004) * math.exp(-t * 1.6)
            v = vel * env * (math.sin(2 * math.pi * f * t)
                             + 0.35 * math.exp(-t * 2.5) * math.sin(4 * math.pi * f * t)
                             + 0.12 * math.exp(-t * 4) * math.sin(6 * math.pi * f * t))
            L[i] += v * (1 - pan)
            R[i] += v * pan
        k += 1
        t0 += step

# envelope intro: soft chime as the seal breaks (2.0 s) and as the letter rises (3.7 s)
for (t0, notes) in [(2.0, [84, 88, 91]), (3.7, [77, 81, 84, 89])]:
    for j, m in enumerate(notes):
        f = hz(m); a = int((t0 + j * 0.09) * SR)
        for i in range(a, min(N, a + int(4 * SR))):
            t = (i - a) / SR
            v = 0.045 * min(1.0, t / 0.003) * math.exp(-t * 1.1) * (math.sin(2 * math.pi * f * t) + 0.2 * math.sin(4 * math.pi * f * t))
            L[i] += v; R[i] += v

# final sparkle chord at 27.2 s and long tail
for m in [77, 81, 84, 89]:
    f = hz(m); a = int((27.2 + (m - 77) * 0.01) * SR)
    for i in range(a, N):
        t = (i - a) / SR
        v = 0.05 * math.exp(-t * 0.6) * math.sin(2 * math.pi * f * t)
        L[i] += v; R[i] += v

# master fade in/out + normalise
peak = max(max(abs(x) for x in L), max(abs(x) for x in R))
g = 0.85 / peak
out = bytearray()
for i in range(N):
    t = i / SR
    fade = min(1.0, t / 0.8) * min(1.0, (DUR - t) / 2.5)
    out += struct.pack('<hh', int(L[i] * g * fade * 32767), int(R[i] * g * fade * 32767))

path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'music_dry.wav')
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out))
print('wrote', path)
