# Compiles and tests bms-connector-java with only the JDK (javac/java/jar) --
# no Maven, no Gradle, no external dependencies. See ../README.md for why.
$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot/.."
$mainSrc = Join-Path $root "src/main/java"
$testSrc = Join-Path $root "src/test/java"
$outMain = Join-Path $root "build/classes/main"
$outTest = Join-Path $root "build/classes/test"

New-Item -ItemType Directory -Force -Path $outMain | Out-Null
New-Item -ItemType Directory -Force -Path $outTest | Out-Null

Write-Host "Compiling main sources..."
$mainFiles = Get-ChildItem -Recurse -Path $mainSrc -Filter *.java | ForEach-Object { $_.FullName }
javac -d $outMain $mainFiles
if ($LASTEXITCODE -ne 0) { throw "main compilation failed" }

Write-Host "Compiling test sources..."
$testFiles = Get-ChildItem -Recurse -Path $testSrc -Filter *.java | ForEach-Object { $_.FullName }
javac -cp $outMain -d $outTest $testFiles
if ($LASTEXITCODE -ne 0) { throw "test compilation failed" }

Write-Host "Building runnable jar..."
$jarPath = Join-Path $root "build/bms-connector.jar"
Push-Location $outMain
jar --create --file $jarPath --main-class au.edu.evidergy.bms.Main .
Pop-Location
if ($LASTEXITCODE -ne 0) { throw "jar packaging failed" }
Write-Host "Wrote $jarPath"

$testClasses = @(
  "au.edu.evidergy.bms.MinimalJsonTest",
  "au.edu.evidergy.bms.TelemetryValidatorTest",
  "au.edu.evidergy.bms.EndToEndRealDataTest"
)

$failed = $false
Push-Location $root  # EndToEndRealDataTest resolves ../data_processed relative to CWD
foreach ($class in $testClasses) {
  Write-Host "`n--- Running $class ---"
  java -cp "$outMain;$outTest" $class
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $class" -ForegroundColor Red
    $failed = $true
  }
}
Pop-Location

if ($failed) {
  Write-Host "`nSome tests failed." -ForegroundColor Red
  exit 1
}
Write-Host "`nAll bms-connector-java tests passed." -ForegroundColor Green
