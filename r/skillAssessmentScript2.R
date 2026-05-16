library(RPostgres)
library(stringr)

#########################################################
## Get data from database
#
### new database, use this one
con <- dbConnect(RPostgres::Postgres(),
                  host = 'ec2-52-204-32-235.compute-1.amazonaws.com',
                  dbname = 'd8dls60coj946l',
                  user = 'u47s3qersh607c',
                  port = 5432,
                  password = 'p29ee7ddcfb2162adad71d7fbc4a8a8f3b8d3aac226fa10effaa4cd31cfa86530')

### old databases, do not use
#con <- dbConnect(RPostgres::Postgres(),
#                 host = 'ec2-54-85-70-234.compute-1.amazonaws.com',
#                 dbname = 'd8dls60coj946l',
#                 user = 'Brian',
#                 port = 5432,
#                 password = 'p987471cabde41c06ce1c9a9352b2f3a7395529162611dd28e6f4faf8258d437d')
#
#con <- dbConnect(RPostgres::Postgres(),
#                 host = 'ec2-3-222-127-167.compute-1.amazonaws.com',
#                 dbname = 'd3eqdrb51b0uao',
#                 user = 'gcocojmycbypvv',
#                 port = 5432,
#                 password = 'd48a6345ef2a7136a3ca0ac26c78a3fd6d9cd5f67fad78d3312bd0c5740edb52')



# get data for new multiple choice questions
datConcept <- dbGetQuery(con,'SELECT "Users"."id" AS "userId", 
                              "Cohorts"."name" AS "cohort",
                              "MultipleChoiceQuestionResults"."multipleChoiceQuestionId", 
                              "PreparedExams"."title" AS "exam",
                              "MultipleChoiceQuestionResults"."score", 
                              "MultipleChoiceQuestionResults"."createdAt",
                              "Categories"."name" AS "category", 
                              "BodyParts"."name" AS "bodyPart",
                              "Regions"."name" AS "region", 
                              "MultipleChoiceQuestions"."difficulty",
                              "MultipleChoiceQuestions"."choices"
                  FROM "MultipleChoiceQuestionResults"
                  LEFT JOIN "Users" ON "MultipleChoiceQuestionResults"."userId"="Users"."id"
                  LEFT JOIN "MultipleChoiceQuestions" ON "MultipleChoiceQuestionResults"."multipleChoiceQuestionId"="MultipleChoiceQuestions"."id"
                  LEFT JOIN "Categories" ON "MultipleChoiceQuestions"."categoryId"="Categories"."id"
                  LEFT JOIN "BodyParts" ON "MultipleChoiceQuestions"."bodyPartId"="BodyParts"."id"
                  LEFT JOIN "Regions" ON "BodyParts"."regionId"="Regions"."id"
                  LEFT JOIN "TestRuns" ON "MultipleChoiceQuestionResults"."testRunId"="TestRuns"."id"
                  LEFT JOIN "PreparedExams" ON "TestRuns"."preparedExamId"="PreparedExams"."id"
                  LEFT JOIN "CohortStudents" ON "Users"."id"="CohortStudents"."userId"
                  LEFT JOIN "Cohorts" ON "CohortStudents"."cohortId"="Cohorts"."id"')



# get data for old multiple choice questions
#dat <- dbGetQuery(con,'SELECT "Users"."nickName", 
#                              "MultipleChoiceQuestionResults"."multipleChoiceQuestionId", 
#                              "MultipleChoiceQuestionResults"."score", 
#                              "MultipleChoiceQuestionResults"."createdAt",
#                              "Categories"."name" AS "category", 
#                              "BodyParts"."name" AS "bodyPart",
#                              "Regions"."name" AS "region", 
#                              "MultipleChoiceQuestions"."difficulty",
#                              "MultipleChoiceQuestions"."choices"
#                  FROM "MultipleChoiceQuestionResults"
#                  INNER JOIN "Users" ON "MultipleChoiceQuestionResults"."userId"="Users"."id"
#                  INNER JOIN "MultipleChoiceQuestions" ON "MultipleChoiceQuestionResults"."multipleChoiceQuestionId"="MultipleChoiceQuestions"."id"
#                  INNER JOIN "Categories" ON "MultipleChoiceQuestions"."categoryId"="Categories"."id"
#                  LEFT JOIN "BodyParts" ON "MultipleChoiceQuestions"."bodyPartId"="BodyParts"."id"
#                  LEFT JOIN "Regions" ON "BodyParts"."regionId"="Regions"."id"')

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

# get data for old positioning questions
#tmp <- dbGetQuery(con,'SELECT "Users"."nickName", 
#                              "StackQuestionResults"."stackQuestionId", 
#                              "StackQuestionResults"."score", 
#                              "StackQuestionResults"."createdAt",
#                              "BodyParts"."name" AS "bodyPart",
#                              "Regions"."name" AS "region", 
#                              "StackQuestions"."difficulty"
#                  FROM "StackQuestionResults"
#                  INNER JOIN "QuestionSetResults" ON "StackQuestionResults"."questionSetResultId"="QuestionSetResults"."id"
#                  INNER JOIN "QuestionSets" ON "QuestionSetResults"."questionSetId"="QuestionSets"."id"
#                  INNER JOIN "Users" ON "QuestionSetResults"."userId"="Users"."id"
#                  INNER JOIN "StackQuestions" ON "StackQuestionResults"."stackQuestionId"="StackQuestions"."id"
#                  LEFT JOIN "BodyParts" ON "QuestionSets"."bodyPartId"="BodyParts"."id"
#                  LEFT JOIN "Regions" ON "BodyParts"."regionId"="Regions"."id"')

# combine the multiple choice and positioning question data  
#dat$stackQuestionId <- NA
#tmp$multipleChoiceQuestionId <- NA
#dat$questionSet <- NA
#tmp$exam <- NA
#
#dat$questionSetScore <- NA
#
#tmp$category <- NA
#tmp$choices <- NA
#
#dat <- rbind(dat,tmp)
#rm(tmp)

# convert relevant columns to factors
datConcept$userId <- factor(datConcept$userId)
datConcept$cohort <- factor(datConcept$cohort)
datConcept$multipleChoiceQuestionId <- factor(datConcept$multipleChoiceQuestionId)
datConcept$exam <- factor(datConcept$exam)
datConcept$category <- factor(datConcept$category)
datConcept$bodyPart <- factor(datConcept$bodyPart)
datConcept$region <- factor(datConcept$region)

datPractical$userId <- factor(datPractical$userId)
datPractical$cohort <- factor(datPractical$cohort)
datPractical$stackQuestionId <- factor(datPractical$stackQuestionId)
datPractical$exam <- factor(datPractical$exam)
datPractical$questionSet <- factor(datPractical$questionSet)
datPractical$bodyPart <- factor(datPractical$bodyPart)
datPractical$region <- factor(datPractical$region)




# make a column for distinguishing between stack and multiple choice questions
#dat$type <- factor(ifelse(is.na(dat$multipleChoiceQuestionId), "stack","multiple_choice"))

# make columns for counting the true and false answers
datConcept$nTrueChoices <- str_count(datConcept$choices,"true")
datConcept$nFalseChoices <- str_count(datConcept$choices,"false")

# discretize scores
discretize_score <- function(score,nTrue,nFalse)
{
  return(ifelse(is.na(nTrue),round(score/25.0),
         ifelse(nTrue<=1,round(score/100.0),round(score/100.0*(nTrue+nFalse)))))   
}

datConcept$discreteScore <- discretize_score(datConcept$score,
                                             datConcept$nTrueChoices,
                                             datConcept$nFalseChoices)


# download questions and users
multipleChoiceQuestions <- dbReadTable(con, "MultipleChoiceQuestions")
stackQuestions <- dbReadTable(con, "StackQuestions")
users <- dbReadTable(con, "Users")
cohorts <- dbReadTable(con, "Cohorts")
cohortStudents <- dbReadTable(con,"CohortStudents")


# disconnect from the data base
dbDisconnect(con)
rm(con)


# ##############################################################################
# ##Queries used during development, not for routine execution
# 
# dbListTables(con)
#
# dbListFields(con,"MultipleChoiceQuestionResults")
#   dbListFields(con,"Users")
#   dbListFields(con,"MultipleChoiceQuestions")
#     dbListFields(con,"Categories")
#     dbListFields(con,"BodyParts")
#       dbListFields(con,"Regions")
#   dbListFields(con,"TestRuns")
#     dbListFields(con,"Users")
#     dbListFields(con,"PreparedExams")
#     dbListFields(con,"BodyParts")
#       dbListFields(con,"Regions")
#
#
# dbListFields(con,"StackQuestionResults")
#   dbListFields(con,"QuestionSetResults")
#     dbListFields(con,"Users")
#     dbListFields(con,"QuestionSets")
#       dbListFields(con,"BodyParts")
#         dbListFields(con,"Regions")
#     dbListFields(con,"TestRuns")
#       dbListFields(con,"Users")
#       dbListFields(con,"PreparedExams")
#       dbListFields(con,"BodyParts")
#         dbListFields(con,"Regions")
#   dbListFields(con,"StackQuestions")
#
#    
# dbListFields(con,"CohortStudents")
#   dbListFields(con,"Users")
#   dbListFields(con,"Cohorts")
#   dbListFields(con,"RegistrationCodes")
#     dbListFields(con,"Cohorts")
#     dbListFields(con,"Users")



# 
# tmp <- dbReadTable(con,"MultipleChoiceQuestionResults")
# nrow(tmp)
# tmp <- dbReadTable(con,"StackQuestionResults")
# nrow(tmp)
# tmp <- dbReadTable(con,"QuestionSetResults")
# nrow(tmp)
# 

###############################################
## Glicko analysis

library(dbplyr)
library(tidyverse)
library(PlayerRatings)
library(ggplot2)
library(GGally)

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

citation()
citation("PlayerRatings")

##################################################################
# Conceptual questions
#
# prepare data for Glicko

subdat <- datConcept %>%
  #  filter(type == "multiple_choice") %>%
  filter(exam %in% goodExams) %>%
  select(createdAt,userId,cohort,multipleChoiceQuestionId,score,category,bodyPart,difficulty) %>%
  rename(Person = userId, Question = multipleChoiceQuestionId) %>%
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
summary(questions)

persons <- glicko_results$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  mutate(Player = fct_reorder(Player,Rating)) %>%
  rename(Person = Player)
summary(persons)
tmp <- persons

history <- as.data.frame(glicko_results$history) %>%
  rownames_to_column("Player") %>%
  pivot_longer(!(Player), names_to = c("Week",".value"), names_sep = "[.]") %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player) %>%
  mutate(Week = as.numeric(Week))

##Conceptual knowledge rating history for one person
#ggplot(history %>% filter(Person == "p_10") ,
#       aes(x=Week,y=Rating,
#           ymin = Rating - 2*Deviation,
#           ymax = Rating + 2*Deviation)) +
#  geom_point() + 
#  geom_crossbar() +
#  ggtitle("Conceptual knowledge rating history for p_10")

ggplot(questions,aes(x=Question,y=Rating,
                     ymin=Rating-Deviation, ymax=Rating+Deviation,
                     fill = Volatility, color = Volatility)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  theme(axis.text.x = element_blank()) +
  geom_crossbar() + 
  geom_point(color="gray") +
  ylab("Difficulty Rating (AU)") +
  ggtitle("Difficulty rating for all conceptual questions")  

questions <- questions %>%
  separate(Question, c(NA,"QuestionID"), remove = FALSE, convert = TRUE) %>%
  left_join(multipleChoiceQuestions,by = c("QuestionID"="id")) %>%
  select("Question","Rating","Deviation","Volatility","difficulty")

ggplot(questions,aes(x=Question,y=Rating,
                     ymin=Rating-Deviation, ymax=Rating+Deviation,
                     fill = difficulty, color = difficulty)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point() +
  ggtitle("Difficulty rating for all conceptual questions with maunal difficulty assessment")  

##ISMRM plot
#ggplot(questions,aes(x=difficulty,y=Rating)) +
#  geom_jitter(width = .2, height = 0) +
#  geom_smooth() +
#  ggtitle("Authors often do not recognize the difficulty of questions") +
#  xlab("Author assessed difficulty (AU)") +
#  ylab("Glicko assessed difficulty rating (AU)")

#ggpairs(questions %>% select(difficulty,Rating))

## Augment persons with cohort and focus on specific cohort
persons <- persons %>%
  left_join(subdat %>% 
              select(Person,cohort) %>%
              unique()) %>%
  mutate(cohort = ifelse(cohort == cohortFocusLong,cohortFocusShort,NA)) %>%
  mutate(Person = fct_reorder(Person,Rating))

ggplot(persons,aes(x=Person,y=Rating, shape = cohort,
                   ymin=Rating-Deviation, ymax=Rating+Deviation,
                   fill = Volatility, color = Volatility)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point(size = 4, color = "gray") + 
  ggtitle("Concpetual knowledge rating for all persons") +
  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

## repetition of the above plot without any focus on a specific cohort
#ggplot(persons,aes(x=Person,y=Rating,
#                   ymin=Rating-Deviation, ymax=Rating+Deviation,
#                   fill = Volatility, color = Volatility)) +
#  scale_fill_viridis_c(aesthetics = c("color","fill")) +
#  geom_crossbar() + 
#  geom_point(size = 4, color = "gray") + 
#  ggtitle("Concpetual knowledge rating for all persons") +
#  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

#write_excel_csv(persons, file = "ConceptualRatings.csv")


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
summary(questions)

persons <- glicko_results$ratings %>%
  select(Player,Rating,Deviation,Volatility) %>%
  filter(str_starts(Player,"p_")) %>%
  mutate(Player = fct_reorder(Player,Rating)) %>%
  rename(Person = Player)
summary(persons)

history <- as.data.frame(glicko_results$history) %>%
  rownames_to_column("Player") %>%
  pivot_longer(!(Player), names_to = c("Week",".value"), names_sep = "[.]") %>%
  filter(str_starts(Player,"p_")) %>%
  rename(Person = Player) %>%
  mutate(Week = as.numeric(Week))

##Plot individual skill history
#ggplot(history %>% filter(Person == "p_10") ,
#       aes(x=Week,y=Rating,
#           ymin = Rating - 2*Deviation,
#           ymax = Rating + 2*Deviation)) +
#  geom_point() + 
#  geom_crossbar() +
#  ggtitle("Total skill rating history for p_10")

ggplot(questions,aes(x=Question,y=Rating,
                     ymin=Rating-Deviation, ymax=Rating+Deviation,
                     fill = Volatility, color = Volatility)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  theme(axis.text.x = element_blank()) +
  geom_crossbar() + 
  geom_point(color = "gray", size = 3) +
  ylab("Difficulty rating (AU)") +
  ggtitle("Difficulty rating for all practical questions")  

## Augment persons with cohort and focus on specific cohort
persons <- persons %>%
  left_join(subdat %>% 
              select(Person,cohort) %>%
              unique()) %>%
  mutate(cohort = ifelse(cohort == cohortFocusLong,cohortFocusShort,NA)) %>%
  mutate(Person = fct_reorder(Person,Rating))

ggplot(persons,aes(x=Person,y=Rating, shape = cohort,
                   ymin=Rating-Deviation, ymax=Rating+Deviation,
                   fill = Volatility, color = Volatility)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point(size = 4, color = "gray") + 
  ggtitle("Total skill rating for all persons") +
  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

## Repetition of the previous plot withot focus on a specific cohort
#ggplot(persons,aes(x=Person,y=Rating,
#                   ymin=Rating-Deviation, ymax=Rating+Deviation,
#                   fill = Volatility, color = Volatility)) +
#  scale_fill_viridis_c(aesthetics = c("color","fill")) +
#  geom_crossbar() + 
#  geom_point(size = 4, color = "gray") + 
#  ylab("Practical skill rating (AU)") +
#  ggtitle("Total skill rating for all persons") +
#  theme(axis.text.x = element_blank())


##################################################
# augment subdat with ratings information

subdat <- subdat %>%
  left_join(persons) %>%
  rename(p_Rating = Rating, p_Deviation = Deviation, p_Volatitity = Volatility) %>%
  left_join(questions) %>%
  rename(q_Rating = Rating, q_Deviation = Deviation, q_Volatitity = Volatility)

##################################################
# augment persons with conceptual and bodyPart-specific information

persons <- persons %>%
  rename(Rating_Total = Rating, Deviation_Total = Deviation, Volatility_Total = Volatility)

levels(persons$Person)
levels(tmp$Person)

tmp <- tmp %>%
  rename(Rating_Conceptual = Rating, Deviation_Conceptual = Deviation, Volatility_Conceptual = Volatility) %>%
  mutate(PersonString = as.character(Person)) %>%
  select(!(Person))
persons <- persons %>%
  mutate(PersonString = as.character(Person)) %>%
  left_join(tmp,by = "PersonString") %>%
  select(!(PersonString))

## ISMRM plot
#ggplot(persons, aes(x=Rating_Conceptual, y=Rating_Total)) +
#  geom_point(size = 2) +
#  geom_smooth(method = "lm") + 
#  xlab("Conceptual skill rating (AU)") +
#  ylab("Practical skil rating (AU)") +
#  ggtitle("Conceptual skill as a predictor of practical skill")

#ggpairs(persons %>% select(Rating_Conceptual,Rating_Total))

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


ggplot(persons,aes(x=Person, y=Rating_Brain, shape = cohort,
                   ymin=Rating_Brain-Deviation_Brain, 
                   ymax=Rating_Brain+Deviation_Brain,
                   fill = Volatility_Brain, color = Volatility_Brain)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point(size = 4, color = "gray") + 
  ggtitle("Brain skill rating for all persons") +
  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

ggplot(persons,aes(x=Person, y=Rating_Knee, shape = cohort,
                   ymin=Rating_Knee-Deviation_Knee, 
                   ymax=Rating_Knee+Deviation_Knee,
                   fill = Volatility_Knee, color = Volatility_Knee)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point(size = 4, color = "gray") + 
  ggtitle("Knee skill rating for all persons") +
  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

ggplot(persons,aes(x=Person, y=Rating_Lumbar, shape = cohort,
                   ymin=Rating_Lumbar-Deviation_Lumbar, 
                   ymax=Rating_Lumbar+Deviation_Lumbar,
                   fill = Volatility_Lumbar, color = Volatility_Lumbar)) +
  scale_fill_viridis_c(aesthetics = c("color","fill")) +
  geom_crossbar() + 
  geom_point(size = 4, color = "gray") + 
  ggtitle("Lumbar skill rating for all persons") +
  theme(axis.text.x = element_text(angle = 90,vjust=0.25))

ggsave(path = "public", filename = "glicko_analysis.png")
# write_excel_csv(persons, file = "PracticalRatings.csv")

#tmp <- glicko2(subdat %>% 
#                 filter(category == "Clinical Procedures") %>%
#                 select(Week,Person,Question,Score), 
#               status = questions %>% rename(Player = Question))$ratings %>%
#  select(Player,Rating,Deviation,Volatility) %>%
#  filter(str_starts(Player,"p_")) %>%
#  rename(Person = Player)
# 
#persons <- persons %>%
#  left_join(tmp) %>%
#  rename(Rating_Clinical = Rating, Deviation_Clinical = Deviation, Volatility_Clinical = Volatility) %>%
#  mutate(Person = fct_reorder(Person,Rating_Total)) 
# 
#ggplot(persons,aes(x=Person, y=Rating_Clinical,
#                   ymin=Rating_Clinical-Deviation_Clinical, 
#                   ymax=Rating_Clinical+Deviation_Clinical,
#                   fill = Volatility_Clinical, color = Volatility_Clinical)) +
#  scale_fill_viridis_c(aesthetics = c("color","fill")) +
#  geom_crossbar() + 
#  geom_point(size = 4.5) +
#  ggtitle("Clinical Procedures category skill rating for all persons")


