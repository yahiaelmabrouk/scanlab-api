# Database upadte guide

## MR Database
1. Create a new database named “scanlab-mr-eu”
2. Add 2 environment variables to the .env file one is the connection string to connect to primary database, one is the connection string to connect to new EU database
```
DATABASE_URL_PRIMARY=postgresql://username:password@hostname/scanlab-mr
DATABASE_URL_EU=postgresql://username:password@hostname/scanlab-mr-eu
```
3. Create the link between EU database and primary database. Replace [postgres] with your primary database username. Replace [eu_database_username] with eu database username. Replace [eu_database_password] with eu database password.
```sql
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

CREATE SERVER eu_west_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host '[hostname]', port '[port]', dbname ‘scanlab-mr-eu’);

CREATE USER MAPPING FOR [postgres]
    SERVER eu_west_server
    OPTIONS (user '[eu_database_username]', password '[eu_database_password]');
   
DROP SCHEMA IF EXISTS eu_west_server_public CASCADE;
CREATE SCHEMA eu_west_server_public;

IMPORT FOREIGN SCHEMA public
    FROM SERVER eu_west_server
    INTO eu_west_server_public;
   
GRANT ALL PRIVILEGES ON SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL TABLES IN SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL SEQUENCES IN SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL FUNCTIONS IN SCHEMA eu_west_server_public TO [postgres];
```
4. Run the following prisma command to generate the tables
```
yarn run prisma-migrate-dev
```
5. Run the following command to insert data to the UserInformation table
```sql
INSERT INTO eu_west_server_public."UserInformations" (
    "userId", "vendorStylePreference", "fieldStrengthPreference", "defaultLanguageCode",
    "softwareVendorPreference", "softwareVersionPreference", "isAdmin", "passHash",
    "email", "legalName", "nickName", "language", "lastIP", "minJWTGeneratedAt",
    "injectionMode", "injectCondition", "defaultContrastOnlyProtocol",
    "defaultContrastAndSalineProtocol", "sliceExpansionBehavior",
    "preferredAnswerCriteriaByStackQuestionId", "createdAt", "updatedAt"
)
SELECT 
    u."id", u."vendorStylePreference", u."fieldStrengthPreference", u."defaultLanguageCode",
    u."softwareVendorPreference", u."softwareVersionPreference", u."isAdmin", u."passHash",
    u."email", u."legalName", u."nickName", u."language", u."lastIP", u."minJWTGeneratedAt",
    u."injectionMode", u."injectCondition", u."defaultContrastOnlyProtocol",
    u."defaultContrastAndSalineProtocol", u."sliceExpansionBehavior",
    u."preferredAnswerCriteriaByStackQuestionId", u."createdAt", u."updatedAt" 
FROM "Users" u 
left join public."CohortStudents" cs 
	on cs."userId" = u.id 
left join public."Cohorts" c
	on c.id = cs."cohortId" 
where c.area = 'eu_west';
```

```sql
INSERT INTO public."UserInformations" (
    "userId", "vendorStylePreference", "fieldStrengthPreference", "defaultLanguageCode",
    "softwareVendorPreference", "softwareVersionPreference", "isAdmin", "passHash",
    "email", "legalName", "nickName", "language", "lastIP", "minJWTGeneratedAt",
    "injectionMode", "injectCondition", "defaultContrastOnlyProtocol",
    "defaultContrastAndSalineProtocol", "sliceExpansionBehavior",
    "preferredAnswerCriteriaByStackQuestionId", "createdAt", "updatedAt"
)
SELECT 
    u."id", u."vendorStylePreference", u."fieldStrengthPreference", u."defaultLanguageCode",
    u."softwareVendorPreference", u."softwareVersionPreference", u."isAdmin", u."passHash",
    u."email", u."legalName", u."nickName", u."language", u."lastIP", u."minJWTGeneratedAt",
    u."injectionMode", u."injectCondition", u."defaultContrastOnlyProtocol",
    u."defaultContrastAndSalineProtocol", u."sliceExpansionBehavior",
    u."preferredAnswerCriteriaByStackQuestionId", u."createdAt", u."updatedAt" 
FROM "Users" u 
left join public."CohortStudents" cs 
	on cs."userId" = u.id  
left join public."Cohorts" c
	on c.id = cs."cohortId" 
where c.area = 'us_east' or c.area is null;
```

## CT Database
1. Create a new database named “scanlab-ct-eu”
2. Add 2 environment variables to the .env file one is the connection string to connect to primary database, one is the connection string to connect to new EU database
```
DATABASE_URL_PRIMARY=postgresql://username:password@hostname/scanlab-ct
DATABASE_URL_EU=postgresql://username:password@hostname/scanlab-ct-eu
```
3. Create the link between EU database and primary database. Replace [postgres] with your primary database username. Replace [eu_database_username] with eu database username. Replace [eu_database_password] with eu database password.
```sql
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

CREATE SERVER eu_west_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host '[hostname]', port '[port]', dbname ‘scanlab-ct-eu’);

CREATE USER MAPPING FOR [postgres]
    SERVER eu_west_server
    OPTIONS (user '[eu_database_username]', password '[eu_database_password]');
   
DROP SCHEMA IF EXISTS eu_west_server_public CASCADE;
CREATE SCHEMA eu_west_server_public;

IMPORT FOREIGN SCHEMA public
    FROM SERVER eu_west_server
    INTO eu_west_server_public;
   
GRANT ALL PRIVILEGES ON SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL TABLES IN SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL SEQUENCES IN SCHEMA eu_west_server_public TO [postgres];
GRANT ALL ON ALL FUNCTIONS IN SCHEMA eu_west_server_public TO [postgres];
```
4. Run the following prisma command to generate the tables
```
yarn run prisma-migrate-dev
```
5. Run the following command to insert data to the UserInformation table
```sql
INSERT INTO eu_west_server_public."UserInformations" (
    "userId", "vendorStylePreference", "fieldStrengthPreference", "defaultLanguageCode",
    "softwareVendorPreference", "softwareVersionPreference", "isAdmin", "passHash",
    "email", "legalName", "nickName", "language", "lastIP", "minJWTGeneratedAt",
    "injectionMode", "injectCondition", "defaultContrastOnlyProtocol",
    "defaultContrastAndSalineProtocol", "sliceExpansionBehavior",
    "preferredAnswerCriteriaByStackQuestionId", "createdAt", "updatedAt"
)
SELECT 
    u."id", u."vendorStylePreference", u."fieldStrengthPreference", u."defaultLanguageCode",
    u."softwareVendorPreference", u."softwareVersionPreference", u."isAdmin", u."passHash",
    u."email", u."legalName", u."nickName", u."language", u."lastIP", u."minJWTGeneratedAt",
    u."injectionMode", u."injectCondition", u."defaultContrastOnlyProtocol",
    u."defaultContrastAndSalineProtocol", u."sliceExpansionBehavior",
    u."preferredAnswerCriteriaByStackQuestionId", u."createdAt", u."updatedAt" 
FROM "Users" u 
left join public."CohortStudents" cs 
	on cs."userId" = u.id 
left join public."Cohorts" c
	on c.id = cs."cohortId" 
where c.area = 'eu_west';
```

```sql
INSERT INTO public."UserInformations" (
    "userId", "vendorStylePreference", "fieldStrengthPreference", "defaultLanguageCode",
    "softwareVendorPreference", "softwareVersionPreference", "isAdmin", "passHash",
    "email", "legalName", "nickName", "language", "lastIP", "minJWTGeneratedAt",
    "injectionMode", "injectCondition", "defaultContrastOnlyProtocol",
    "defaultContrastAndSalineProtocol", "sliceExpansionBehavior",
    "preferredAnswerCriteriaByStackQuestionId", "createdAt", "updatedAt"
)
SELECT 
    u."id", u."vendorStylePreference", u."fieldStrengthPreference", u."defaultLanguageCode",
    u."softwareVendorPreference", u."softwareVersionPreference", u."isAdmin", u."passHash",
    u."email", u."legalName", u."nickName", u."language", u."lastIP", u."minJWTGeneratedAt",
    u."injectionMode", u."injectCondition", u."defaultContrastOnlyProtocol",
    u."defaultContrastAndSalineProtocol", u."sliceExpansionBehavior",
    u."preferredAnswerCriteriaByStackQuestionId", u."createdAt", u."updatedAt" 
FROM "Users" u 
left join public."CohortStudents" cs 
	on cs."userId" = u.id  
left join public."Cohorts" c
	on c.id = cs."cohortId" 
where c.area = 'us_east' or c.area is null;
```