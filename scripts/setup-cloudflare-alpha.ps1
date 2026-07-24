param(
  [string]$D1Name = "level-grind-kb-alpha",
  [string]$R2Bucket = "level-grind-kb-files-alpha"
)

Write-Host "Creating Cloudflare D1 database: $D1Name"
npx wrangler d1 create $D1Name

Write-Host "Creating Cloudflare R2 bucket: $R2Bucket"
npx wrangler r2 bucket create $R2Bucket

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Copy wrangler.example.jsonc to wrangler.jsonc."
Write-Host "2. Paste the D1 database_id printed above."
Write-Host "3. Add your Clerk keys as Cloudflare environment variables/secrets."
Write-Host "4. Add invited emails to LEVEL_GRIND_INVITED_EMAILS."
