# Transcode WAV -> AAC-LC in .m4a with Windows' own Media Foundation encoder (WinRT MediaTranscoder).
# Windows PowerShell 5.1 only (PowerShell 7 has no WinRT projection).
# Usage: powershell -File mf_encode.ps1 -List jobs.tsv     (each line: <in.wav>\t<out.m4a>\t<bitrate>\t<channels>\t<rate>)
param([Parameter(Mandatory = $true)][string]$List)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.AudioEncodingProperties, Windows.Media.MediaProperties, ContentType = WindowsRuntime]

$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asTaskProg = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTaskOp.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(-1); $task.Result }
function AwaitProgress($op) { $task = $asTaskProg.MakeGenericMethod([double]).Invoke($null, @($op)); [void]$task.Wait(-1); if ($task.IsFaulted) { throw $task.Exception } }

$tc = New-Object Windows.Media.Transcoding.MediaTranscoder
$tc.AlwaysReencode = $true
$ok = 0; $fail = 0
foreach ($line in Get-Content -LiteralPath $List) {
    if (-not $line.Trim()) { continue }
    $in, $out, $br, $ch, $rate = $line -split "`t"
    try {
        $dir = Split-Path -Parent $out
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        $src = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($in)) ([Windows.Storage.StorageFile])
        $folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($dir)) ([Windows.Storage.StorageFolder])
        $dst = Await ($folder.CreateFileAsync((Split-Path -Leaf $out), [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
        $prof = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateM4a([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)
        $prof.Audio = [Windows.Media.MediaProperties.AudioEncodingProperties]::CreateAac([uint32]$rate, [uint32]$ch, [uint32]$br)
        $prep = Await ($tc.PrepareFileTranscodeAsync($src, $dst, $prof)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
        if (-not $prep.CanTranscode) { throw "cannot transcode: $($prep.FailureReason)" }
        AwaitProgress ($prep.TranscodeAsync())
        $ok++
    } catch {
        $fail++
        Write-Output "FAIL`t$in`t$($_.Exception.Message)"
    }
}
Write-Output "done: $ok ok, $fail failed"
