library(RPostgres)
library(stringr)

#########################################################
## Get data from database
#
### new database, use this one
con <- dbConnect(RPostgres::Postgres(),
                 host = 'ec2-3-210-100-223.compute-1.amazonaws.com',
                 dbname = 'd8dls60coj946l',
                 user = 'kyle',
                 port = 5432,
                 password = 'p375510e36b4cba7edca2e56b5fd658792eaa21dc5a77249c307af4bd5aae2173')

# get data for new positioning questions
datPractical <- dbGetQuery(con,'SELECT "QuestionSetResults"."userId", 
                              "Cohorts"."name" AS "cohort",
                              "StackQuestionResults"."stackQuestionId", 
                              "QuestionSets"."name" AS "questionSet",
                              "PreparedExams"."title" AS "exam",
                              "StackQuestionResults"."score", 
                              "StackQuestionResults"."createdAt",
                              "BodyParts"."name" AS "bodyPart",
                              "Regions"."name" AS "region", 
                              "StackQuestions"."difficulty"
                  FROM "StackQuestionResults"
                  LEFT JOIN "QuestionSetResults" ON "StackQuestionResults"."questionSetResultId"="QuestionSetResults"."id"
                  LEFT JOIN "QuestionSets" ON "QuestionSetResults"."questionSetId"="QuestionSets"."id"
                  LEFT JOIN "Users" ON "QuestionSetResults"."userId"="Users"."id"
                  LEFT JOIN "StackQuestions" ON "StackQuestionResults"."stackQuestionId"="StackQuestions"."id"
                  LEFT JOIN "BodyParts" ON "QuestionSets"."bodyPartId"="BodyParts"."id"
                  LEFT JOIN "Regions" ON "BodyParts"."regionId"="Regions"."id"
                  LEFT JOIN "CohortStudents" ON "CohortStudents"."userId"="Users"."id"
                  LEFT JOIN "Cohorts" ON "Cohorts"."id"="CohortStudents"."cohortId"
                  LEFT JOIN "TestRuns" ON "TestRuns"."id"="QuestionSetResults"."testRunId"
                  LEFT JOIN "PreparedExams" ON "PreparedExams"."id"="TestRuns"."preparedExamId"')

# convert relevant columns to factors
datPractical$userId <- factor(datPractical$userId)
datPractical$cohort <- factor(datPractical$cohort)
datPractical$stackQuestionId <- factor(datPractical$stackQuestionId)
datPractical$exam <- factor(datPractical$exam)
datPractical$questionSet <- factor(datPractical$questionSet)
datPractical$bodyPart <- factor(datPractical$bodyPart)
datPractical$region <- factor(datPractical$region)

# discretize scores
discretize_score <- function(score,nTrue,nFalse)
{
  return(ifelse(is.na(nTrue),round(score/25.0),
                ifelse(nTrue<=1,round(score/100.0),round(score/100.0*(nTrue+nFalse)))))   
}

# download questions and users
multipleChoiceQuestions <- dbReadTable(con, "MultipleChoiceQuestions")
stackQuestions <- dbReadTable(con, "StackQuestions")
users <- dbReadTable(con, "Users")
cohorts <- dbReadTable(con, "Cohorts")
cohortStudents <- dbReadTable(con,"CohortStudents")

# disconnect from the data base
dbDisconnect(con)
rm(con)

###############################################
## Glicko analysis

library(dbplyr)
library(tidyverse)
library(PlayerRatings)

##############################################
## Cohort focus
cohortFocusLong  = "UofL Health - Skill Assessment (2022)"
cohortFocusShort = "UofL"
cohortFocusLong  = "3H Vision - MR Assessments"
cohortFocusShort = "Vision"

# keep only good data
goodExams = c(
  "Clinical Validation Study",                             
  "Clinical Validation Study Part 2",                      
  "Critical Thinking",                                     
  "Freiburg/Essen (Brain - German)",                       
  "Freiburg/Essen (Knee - German)",                        
  "Freiburg/Essen (Lumbar - German)",                      
  "MR Assessment (Brain - German) - Attempt #1",           
  "MR Assessment (Brain - German) - Attempt #2",           
  "MR Assessment (Knee - German) - Attempt #1",            
  "MR Assessment (Knee - German) - Attempt #2",            
  "MR Assessment (Lumbar - German) - Attempt #1",          
  "MR Assessment (Lumbar - German) - Attempt #2",          
  "MR Assessment (Resolution Brain - German) - Attempt #1",
  "MR Assessment (Resolution Brain - German) - Attempt #2",
  "MR Staff Assessment - Brain ",                          
  "MR Staff Assessment - Brain (2nd Assessment)",          
  "MR Staff Assessment - Brain (3rd Assessment)",          
  "MR Staff Assessment - Knee",                            
  "MR Staff Assessment - Knee (2nd Assessment)",           
  "MR Staff Assessment - Knee (3rd Assessment)",           
  "MR Staff Assessment - Lumbar",                          
  "MR Staff Assessment - Lumbar (2nd Assessment)",         
  "MR Staff Assessment - Lumbar (3rd Assessment)")


##################################################################
# Practical questions
#
# prepare data for Glicko

subdat <- datPractical %>%
  filter(!is.na(score)) %>%
  filter(exam %in% goodExams) %>%
  select(createdAt,userId,cohort,stackQuestionId,score,bodyPart,difficulty) %>%
  rename(Person = userId, Question = stackQuestionId) %>%
  mutate(score = score/100.0) %>% # make scores range from 0 to 1 instead of 0 to 100
  rename(Score = score) %>%
  mutate(createdAt = floor(as.integer(createdAt)/604800)) %>% # 604800 is the number of seconds in one week
  rename(Week = createdAt) %>%
  mutate(Person = paste("p_",as.character(Person), sep = "")) %>%
  mutate(Question = paste("q_",as.character(Question), sep = "")) %>%
  filter(!(Person %in% c("p_363"))) # p_363 is Matthew

############################################################
# run glicko to establish initial question difficulty

glicko_results <- glicko2(subdat %>% select(Week,Person,Question,Score))
#warnings()

questions <- glicko_results$ratings %>% 
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"q_")) %>%
  rename(Question = Player)

#########################################################
# find and remove bad questions (volatility > 1.0)

bad_questions <- questions %>%
  filter(Volatility > 1.0) %>%
  select(Question)

questions <- questions %>%
  filter(!(Question %in% bad_questions$Question))

subdat <- subdat %>%
  filter(!(Question %in% bad_questions$Question))

################################################  
# run glicko again to get person skill ratings

glicko_results <- glicko2(subdat %>% select(Week,Person,Question,Score), 
                          status = questions %>% rename(Player = Question),
                          #init = c(1500,500,2.0),
                          #rdmax = 800,
                          #tau = 0.3,
                          history = TRUE)

questions <- glicko_results$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"q_")) %>%
  mutate(Player = fct_reorder(Player,Rating)) %>%
  rename(Question = Player)

persons <- glicko_results$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  mutate(Player = fct_reorder(Player,Rating)) %>%
  rename(Person = Player)

history <- as.data.frame(glicko_results$history) %>%
  rownames_to_column("Player") %>%
  pivot_longer(!(Player), names_to = c("Week",".value"), names_sep = "[.]") %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player) %>%
  mutate(Week = as.numeric(Week))

## Augment persons with cohort and focus on specific cohort
persons <- persons %>%
  left_join(subdat %>% 
              select(Person,cohort) %>%
              unique()) %>%
  # mutate(cohort = ifelse(cohort == cohortFocusLong,cohortFocusShort,NA)) %>%
  mutate(Person = fct_reorder(Person,Rating))

##################################################
# augment subdat with ratings information

subdat <- subdat %>%
  left_join(persons) %>%
  rename(p_Rating = Rating, p_Deviation = Deviation, p_Volatitity = Volatility) %>%
  left_join(questions) %>%
  rename(q_Rating = Rating, q_Deviation = Deviation, q_Volatitity = Volatility)

##################################################
# augment persons with bodyPart-specific information

persons <- persons %>%
  rename(Rating_Total = Rating, Deviation_Total = Deviation, Volatility_Total = Volatility)

persons <- persons %>%
  mutate(PersonString = as.character(Person)) %>%
  select(!(PersonString))

tmp <- glicko2(subdat %>% 
                 filter(bodyPart == "Brain (Contrast Lab)") %>%
                 select(Week,Person,Question,Score), 
               status = questions %>% rename(Player = Question))$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player)

persons <- persons %>%
  left_join(tmp) %>%
  rename(Rating_Brain = Rating, Deviation_Brain = Deviation, Volatility_Brain = Volatility) %>%
  mutate(Person = fct_reorder(Person,Rating_Total))

tmp <- glicko2(subdat %>% 
                 filter(bodyPart == "Knee") %>%
                 select(Week,Person,Question,Score), 
               status = questions %>% rename(Player = Question))$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player)

persons <- persons %>%
  left_join(tmp) %>%
  rename(Rating_Knee = Rating, Deviation_Knee = Deviation, Volatility_Knee = Volatility) %>%
  mutate(Person = fct_reorder(Person,Rating_Total))

tmp <- glicko2(subdat %>% 
                 filter(bodyPart == "Lumbar") %>%
                 select(Week,Person,Question,Score), 
               status = questions %>% rename(Player = Question))$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player)

persons <- persons %>%
  left_join(tmp) %>%
  rename(Rating_Lumbar = Rating, Deviation_Lumbar = Deviation, Volatility_Lumbar = Volatility) %>%
  mutate(Person = fct_reorder(Person,Rating_Total))

#write_excel_csv(persons, file = "PracticalRatings.csv")

# print(persons)
print(persons%>%select(Person,cohort,Rating_Total,Deviation_Total,Volatility_Total))
print(persons%>%select(Person,cohort,Rating_Brain,Deviation_Brain,Volatility_Brain))
print(persons%>%select(Person,cohort,Rating_Knee,Deviation_Knee,Volatility_Knee))
print(persons%>%select(Person,cohort,Rating_Lumbar,Deviation_Lumbar,Volatility_Lumbar))
