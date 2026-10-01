#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."
export AWS_PAGER=""

npm run build

aws s3 sync ./dist/ s3://remepy-media-dev-pd/cyan/games/ --profile dev-pd 
aws cloudfront create-invalidation --profile dev-pd --distribution-id E1OBENX31WPFEA --paths "/cyan/games/*"
aws cloudfront create-invalidation --profile dev-pd --distribution-id E284GRDL6O0FTL --paths "/assets/cyan/games/*"

