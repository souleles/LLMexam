# Scripts

Utility scripts for ExamChecker development and operations.

## Index

_No scripts yet — add as the project grows._

## Planned Scripts

| Script | Purpose |
|--------|---------|
| `seed-db.ts` | Seed PostgreSQL with sample exercises and checkpoints for local testing |
| `test-grading.ts` | Run the grading pipeline against a specific exercise and print results |
| `export-results.ts` | Export grading results for a given exercise to CSV |

## Conventions

- TypeScript scripts live here if they are backend utilities (run with `ts-node`)
- Python scripts for AI/data tasks go in `python-service/scripts/`
- All scripts should accept CLI flags and print usage with `--help`
