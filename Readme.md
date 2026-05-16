# ScanLabMR API

## Setup

- Install Volta from <https://volta.sh/>
- `yarn install`
- Create a `.env` in the root of the project. This file will contain secrets to be used locally. Please reference [.env.defaults](.env.defaults) for the purpose of each value. Ask a teammate for the available secrets.

### Install Postgres

- Install Docker and run `yarn dev-db` to start a local Postgres container with a `scanlab` db (you'll have to run this again each time you restart your PC)
  - OR: Install Postgres 11 locally, pick password: `e5832048e0`, and [Create a database](https://www.guru99.com/postgresql-create-database.html) named: `scanlab`
- `yarn run prisma migrate dev`

## Start

- Use `yarn serve` to run node in debug mode as well as start nodemon to listen to file changes
- Use `yarn cruise` to install dependencies and run server (assumes DB is already running). Use this for when you're only working on the frontend.

## Backup / Restore a DB
- Backup your db into `db_backup.dump`:
  - `docker exec pg-scanlab /usr/bin/pg_dump -U postgres -Fc -f db_backup.dump scanlab`


- Assuming you have no data in the container, you can later restore it with:
  - (If you already had data, you may have to delete the container + the storage volume first)
  - `yarn dev-db` to start your db container
  - `docker cp db_backup.dump pg-scanlab:/` to copy the file into your volume
  - `docker exec -i pg-scanlab pg_restore -j 8 -U postgres -d scanlab /db_backup.dump` to restore the db

If you got a database dump from somebody else, use an SQL Editor to change the passHash has of their Users to:
`$2a$10$D6K2i.1VF4m6O6wEMckQTu28VX7BgIpMC6SiMGRS/mg6HGYQE5Dzm` to make their password "password"

## Migrations

### Create & run

Running `yarn run prisma migrate dev` will both run existing migrations and create new ones in development environments.

In order to create one, update `prisma/schema.prisma` and then run: `yarn run prisma migrate dev`

For more, [read about Prisma Migrate here](https://www.prisma.io/docs/concepts/components/prisma-migrate).

### Production

For production/staging environments, prisma has a separate command to run migrations:

- Heroku Run Bash: `heroku run --app=scanlab-api bash`
- `yarn run prisma migrate deploy`

### Data migrations

Prisma doesn't give you a way to create data migrations, it is solely used for schema migrations.

For now, we should write them as scripts in the `scripts/` directory and call them out in the `scanlab-eng` slack channel so someone with production access can run them.
If you know of a good tool for node for data migrations, please let us know about it so we can evaluate it as a proper alternative to this.

## Production

Pushes to master trigger deploys in Heroku. This includes migrations.
To trigger a deploy manually: (do `heroku login` first)
`yarn ship`

## Indexing

Run this SQL to create indexes:

```
SET schema 'public';
CREATE INDEX idx_Cohorts ON "Cohorts"("id", "name");
CREATE INDEX idx_CohortStudents ON "CohortStudents"("id", "userId");
CREATE INDEX idx_Users ON "Users"("id", "legalName");
CREATE INDEX idx_MultipleChoiceQuestionResults ON "MultipleChoiceQuestionResults"("id", "userId", "answer");
CREATE INDEX idx_PreparedExams ON "PreparedExams"("id", "title");
CREATE INDEX idx_TestRuns ON "TestRuns"("id");
CREATE INDEX idx_MultipleChoiceQuestions ON "MultipleChoiceQuestions"("id");
CREATE INDEX idx_Categories ON "Categories"("id");
CREATE INDEX idx_BodyParts ON "BodyParts"("id");
CREATE INDEX idx_Regions ON "Regions"("id");

-- DROP INDEX idx_Cohorts;
-- DROP INDEX idx_CohortStudents;
-- DROP INDEX idx_Users;
-- DROP INDEX idx_MultipleChoiceQuestionResults;
-- DROP INDEX idx_PreparedExams;
-- DROP INDEX idx_TestRuns;
-- DROP INDEX idx_MultipleChoiceQuestions;
-- DROP INDEX idx_Categories;
-- DROP INDEX idx_BodyParts;
-- DROP INDEX idx_Regions;
```

## Run Redis in Docker
docker compose up -d