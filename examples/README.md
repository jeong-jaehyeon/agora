# Examples

샘플 리뷰 결과 데이터와 생성된 HTML 리포트입니다.

## 파일 설명

- `sample-data.json` — AI 리뷰 결과 JSON (ReportData 스키마)
- `sample-report.html` — JSON으로 생성된 HTML 리포트 (브라우저에서 바로 열기 가능)

## HTML 리포트 재생성

```bash
npx tsx scripts/generate-report.ts examples/sample-data.json -o examples/sample-report.html
```
