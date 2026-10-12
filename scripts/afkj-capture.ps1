<#
  Flips through your AFK Journey heroes, screenshots each hero page and reads it with Windows OCR.
  Writes .data/capture/raw.json; scripts/afkj-import.ts turns that into an importable backup.

  Before running: AFK Journey in borderless fullscreen, open the FIRST hero's detail page
  (the one with the Ascend button). Don't touch the mouse while it runs; switching away from
  the game stops it.

  -FromFrames <dir>  Re-read saved frames (f000.jpg/png, f001...) instead of clicking through the game.
#>
param(
  [string]$Out = (Join-Path $PSScriptRoot '..\.data\capture'),
  [int]$Max = 160,
  [int]$DelayMin = 2000,
  [int]$DelayMax = 3000,
  [string]$FromFrames = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class AfkWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
[AfkWin]::SetProcessDPIAware() | Out-Null

# --- Windows OCR (WinRT) -----------------------------------------------------------------
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(); $t.Result }
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { throw 'Windows OCR is not available. Add an English language pack in Settings > Time & language.' }

$tmp = Join-Path $env:TEMP 'afkj-ocr.png'
function Read-Text([System.Drawing.Bitmap]$bmp) {
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sb = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    (Await ($engine.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])).Text
  } finally { $stream.Dispose() }
}

# --- Geometry (measured at 1920x1080, scaled to the actual screen) -----------------------
$W = [AfkWin]::GetSystemMetrics(0); $H = [AfkWin]::GetSystemMetrics(1)
$sx = $W / 1920; $sy = $H / 1080
function Scale-Rect([int]$x, [int]$y, [int]$w, [int]$h) {
  New-Object System.Drawing.Rectangle ([int]($x * $sx)), ([int]($y * $sy)), ([int]($w * $sx)), ([int]($h * $sy))
}
$NameBox = Scale-Rect 482 30 450 62     # hero name (stops above the skill icons)
$NameBox2 = Scale-Rect 495 30 430 75    # tighter on the left; some names only read with this one
$BadgeBox = Scale-Rect 420 10 80 30     # tier badge text ("Supreme+", "Paragon")
$AscendBox = Scale-Rect 600 1018 95 28  # "have/need" under the Ascend button
$CrystalBox = Scale-Rect 445 80 25 50   # tier crystal (colour tells Paragon levels apart)
$Next = @{ X = [int](1453 * $sx); Y = [int](615 * $sy) }

# Crop, upscale, pad with white (OCR misses short text without a margin), and optionally
# keep only bright (white) pixels as black-on-white text.
function Crop([System.Drawing.Bitmap]$src, $rect, [int]$scale, [int]$bright, [string]$label = '', [int]$pad = 24) {
  $lead = if ($label) { 260 } else { 0 }
  $w = $rect.Width * $scale + 2 * $pad + $lead; $h = $rect.Height * $scale + 2 * $pad
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle ($pad + $lead), $pad, ($w - 2 * $pad - $lead), ($h - 2 * $pad)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  if ($label) {
    # A word in front of short text like "1/4" gives OCR a full line to work with.
    $font = New-Object System.Drawing.Font 'Arial', ([float]($rect.Height * $scale * 0.45)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString($label, $font, [System.Drawing.Brushes]::Black, $pad, ($h / 2 - $font.Height / 2))
    $font.Dispose()
  }
  $g.Dispose()
  if ($bright -gt 0) {
    $data = $bmp.LockBits((New-Object System.Drawing.Rectangle 0, 0, $w, $h), 'ReadWrite', 'Format32bppArgb')
    $bytes = New-Object byte[] ($data.Stride * $h)
    [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    for ($i = 0; $i -lt $bytes.Length; $i += 4) {
      $v = if ($bytes[$i] -ge $bright -and $bytes[$i + 1] -ge $bright -and $bytes[$i + 2] -ge $bright) { 0 } else { 255 }
      $bytes[$i] = $v; $bytes[$i + 1] = $v; $bytes[$i + 2] = $v
    }
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
    $bmp.UnlockBits($data)
  }
  $bmp
}

function Average-Color([System.Drawing.Bitmap]$src, $rect) {
  $r = 0; $g = 0; $b = 0; $n = 0
  for ($y = $rect.Top; $y -lt $rect.Bottom; $y += 2) {
    for ($x = $rect.Left; $x -lt $rect.Right; $x += 2) { $p = $src.GetPixel($x, $y); $r += $p.R; $g += $p.G; $b += $p.B; $n++ }
  }
  @([int]($r / $n), [int]($g / $n), [int]($b / $n))
}

# Each field is read with a list of crop settings: @(box, scale, brightness threshold, label, padding).
# OCR is fickle - a setting that works for one hero can miss the next - so try them in order and
# stop once two readings agree.
$NamePasses = @(
  @($NameBox, 2, 0, '', 24), @($NameBox2, 2, 0, '', 0), @($NameBox, 2, 225, '', 24), @($NameBox2, 2, 225, '', 0),
  @($NameBox, 2, 200, '', 24), @($NameBox, 3, 180, '', 24), @($NameBox2, 3, 240, '', 0), @($NameBox2, 2, 200, '', 0)
)
$BadgePasses = @(@($BadgeBox, 4, 0, '', 24), @($BadgeBox, 4, 170, '', 24), @($BadgeBox, 4, 0, '', 0), @($BadgeBox, 3, 200, '', 0))
$AscendPasses = @(
  @($AscendBox, 4, 0, '', 0), @($AscendBox, 4, 200, '', 0), @($AscendBox, 4, 0, '', 24), @($AscendBox, 4, 200, '', 24),
  @($AscendBox, 5, 170, 'Count', 24), @($AscendBox, 4, 200, 'Count', 24), @($AscendBox, 5, 230, 'Count', 24),
  @($AscendBox, 5, 140, 'Count', 24), @($AscendBox, 6, 120, 'Count', 24), @($AscendBox, 5, 0, 'Count', 24)
)

function Read-Field([System.Drawing.Bitmap]$shot, $passes, [scriptblock]$key) {
  $reads = @(); $seen = @{}
  foreach ($p in $passes) {
    $c = Crop $shot $p[0] $p[1] $p[2] $p[3] $p[4]; $text = Read-Text $c; $c.Dispose()
    $reads += $text
    $k = & $key $text
    if ($k) { if ($seen[$k]) { break }; $seen[$k] = $true }
  }
  ,$reads
}
$nameKey = { param($t) $k = ($t -replace '[^A-Za-z]', '').ToLower(); if ($k.Length -ge 3) { $k } }
$badgeKey = { param($t) $k = ($t -replace '[^A-Za-z+]', '').ToLower(); if ($k.Length -ge 4) { $k } }
$ascendKey = { param($t) if ($t -match '(\d+)\s*/\s*(\d+)') { $Matches[0] -replace '\s', '' } }

# Read one hero page; the import step picks the best match from the readings.
function Read-Hero([System.Drawing.Bitmap]$shot) {
  [ordered]@{
    name = (Read-Field $shot $NamePasses $nameKey)
    badge = (Read-Field $shot $BadgePasses $badgeKey)
    ascend = (Read-Field $shot $AscendPasses $ascendKey)
    crystal = (Average-Color $shot $CrystalBox)
  }
}

# Lower-case letters only, so OCR noise like "Frierep" vs "Frieren" still lines up loosely.
function Name-Keys($names) { @($names | ForEach-Object { ($_ -replace '[^A-Za-z]', '').ToLower() } | Where-Object { $_.Length -ge 3 }) }
function Same-Hero($a, $b) { @($a | Where-Object { $b -contains $_ }).Count -gt 0 }

function Foreground {
  $sb = New-Object System.Text.StringBuilder 256
  [AfkWin]::GetWindowText([AfkWin]::GetForegroundWindow(), $sb, 256) | Out-Null
  $sb.ToString()
}

function Screenshot {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size); $g.Dispose()
  $bmp
}

function Click-Next {
  [AfkWin]::SetCursorPos($Next.X + (Get-Random -Min -6 -Max 7), $Next.Y + (Get-Random -Min -10 -Max 11)) | Out-Null
  Start-Sleep -Milliseconds (Get-Random -Min 80 -Max 170)
  [AfkWin]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds (Get-Random -Min 50 -Max 120)
  [AfkWin]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
}

# --- Main --------------------------------------------------------------------------------
$Out = [IO.Path]::GetFullPath($Out)
$framesDir = Join-Path $Out 'frames'
New-Item -ItemType Directory -Force $framesDir | Out-Null
$heroes = New-Object System.Collections.Generic.List[object]

if ($FromFrames) {
  $files = Get-ChildItem $FromFrames -File | Where-Object { $_.Name -match '^f\d+\.(png|jpg)$' } | Sort-Object Name
  foreach ($f in $files) {
    $shot = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $h = Read-Hero $shot; $h.frame = $f.BaseName; $heroes.Add($h); $shot.Dispose()
    Write-Host ("{0}: {1} | {2} | {3}" -f $f.BaseName, ($h.name -join ' / '), ($h.badge -join ' / '), ($h.ascend -join ' / '))
  }
} else {
  Get-ChildItem $framesDir -File | Remove-Item
  $jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $quality = New-Object System.Drawing.Imaging.EncoderParameters 1
  $quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L
  Write-Host 'Switch to AFK Journey now (first hero page open). Starting in 5 seconds...'
  Start-Sleep -Seconds 5
  $first = @(); $last = @(); $same = 0
  for ($i = 0; $i -lt $Max; $i++) {
    if ((Foreground) -ne 'AFK Journey') { Write-Host "Stopped: AFK Journey is not in front ('$(Foreground)')."; break }
    $shot = Screenshot
    $frame = 'f{0:D3}' -f $i
    $shot.Save((Join-Path $framesDir "$frame.jpg"), $jpeg, $quality)  # kept so you can check flagged heroes
    $h = Read-Hero $shot; $h.frame = $frame; $shot.Dispose()
    $keys = Name-Keys $h.name
    Write-Host ("{0}: {1} | {2} | {3}" -f $frame, ($keys | Select-Object -First 1), ($h.badge -join ' / '), ($h.ascend -join ' / '))
    if ($i -gt 1 -and (Same-Hero $keys $first)) { Write-Host 'Back at the first hero - done.'; break }
    if (Same-Hero $keys $last) { $same++ } else { $same = 0 }
    if ($same -ge 2) { Write-Host 'The page stopped changing - done.'; break }
    $heroes.Add($h)
    if ($i -eq 0) { $first = $keys }
    $last = $keys
    Click-Next
    Start-Sleep -Milliseconds (Get-Random -Min $DelayMin -Max $DelayMax)
  }
}

$raw = [ordered]@{ capturedAt = (Get-Date).ToString('o'); screen = "${W}x${H}"; heroes = $heroes }
$raw | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $Out 'raw.json')
Write-Host "Read $($heroes.Count) hero pages -> $(Join-Path $Out 'raw.json')"
