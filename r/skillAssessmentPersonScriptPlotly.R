library(RPostgres)
library(stringr)
library(dbplyr)
library(tidyverse)
library(PlayerRatings)
library(ggplot2)
library(GGally)
library(plotly)
library(profvis)
library(ggpubr)

# start.time <- Sys.time()

run <- function(person_id){
  #########################################################
  ## Get data from database
  #
  # tryCatch( {
    
    ## new database, use this one
    # con <- dbConnect(RPostgres::Postgres(),
    #                 host = 'ec2-52-44-175-221.compute-1.amazonaws.com',
    #                 dbname = 'd8dls60coj946l',
    #                 user = 'u3jj8d9m25s9i0',
    #                 port = 5432,
    #                 password = 'pf18418e4971e399655a6bfd03f99eb6b9537a55e9a54305f2ee3cb984b29c285')
    con <- dbConnect(RPostgres::Postgres(),
                 host = 'ec2-52-204-32-235.compute-1.amazonaws.com',
                 dbname = 'd8dls60coj946l',
                 user = 'u3k4p1bip20g2f',
                 port = 5432,
                 password = 'pce59c1f57630e0040ab4303ca47c015861af4fec0708ca25fd4b3e779f0a635f')
    
    # get data for new multiple choice questions
    datConcept <- dbGetQuery(con, 'SELECT "Users"."id" AS "userId", 
                              "Cohorts"."name" AS "cohort",
                              "MultipleChoiceQuestionResults"."multipleChoiceQuestionId", 
                              "PreparedExams"."title" AS "exam",
                              "MultipleChoiceQuestionResults"."score", 
                              "MultipleChoiceQuestionResults"."createdAt",
                              "Categories"."name" AS "category", 
                              "BodyParts"."name" AS "bodyPart",
                              "Regions"."name" AS "region", 
                              "MultipleChoiceQuestions"."difficulty",
                              "MultipleChoiceQuestions"."choices",
                              "cohortId"
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
    
    # convert relevant columns to factors
    datConcept$userId <- factor(datConcept$userId)
    datConcept$cohort <- factor(datConcept$cohort)
    datConcept$multipleChoiceQuestionId <- factor(datConcept$multipleChoiceQuestionId)
    datConcept$exam <- factor(datConcept$exam)
    datConcept$category <- factor(datConcept$category)
    datConcept$bodyPart <- factor(datConcept$bodyPart)
    datConcept$region <- factor(datConcept$region)
    
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
    
    users$Person <- paste0("p_","",users$id)
    
    # disconnect from the data base
    dbDisconnect(con)
    rm(con)
    
    
    
    
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
    #personsAugment <- persons
    
    history <- as.data.frame(glicko_results$history) %>%
      rownames_to_column("Player") %>%
      pivot_longer(!(Player), names_to = c("Week",".value"), names_sep = "[.]") %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player) %>%
      mutate(Week = as.numeric(Week))
    
    questions <- questions %>%
      separate(Question, c(NA,"QuestionID"), remove = FALSE, convert = TRUE) %>%
      left_join(multipleChoiceQuestions,by = c("QuestionID"="id")) %>%
      select("Question","Rating","Deviation","Volatility","difficulty")
    
    ## Augment persons with cohort and focus on specific cohort
    persons <- persons %>%
      left_join(subdat %>% 
                  select(Person,cohort) %>%
                  unique()) %>%
      mutate(cohort = ifelse(cohort == cohortFocusLong,cohortFocusShort,NA)) %>%
      mutate(Person = fct_reorder(Person,Rating))
    
    ##################################################
    # augment subdat with ratings information
    
    subdat <- subdat %>%
      left_join(persons) %>%
      rename(p_Rating = Rating, p_Deviation = Deviation, p_Volatitity = Volatility) %>%
      left_join(questions) %>%
      rename(q_Rating = Rating, q_Deviation = Deviation, q_Volatitity = Volatility)
    
    ##################################################
    # augment persons with category-specific information
    
    persons <- persons %>%
      rename(Rating_Total = Rating, Deviation_Total = Deviation, Volatility_Total = Volatility)
    
    levels(persons$Person)
    
    persons <- persons %>%
      mutate(PersonString = as.character(Person)) %>%
      select(!(PersonString))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Anatomy") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Anatomy = Rating, Deviation_Anatomy = Deviation, Volatility_Anatomy = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Angiography") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Angiography = Rating, Deviation_Angiography = Deviation, Volatility_Angiography = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Artifacts") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Artifacts = Rating, Deviation_Artifacts = Deviation, Volatility_Artifacts = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Cardiac") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Cardiac = Rating, Deviation_Cardiac = Deviation, Volatility_Cardiac = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Clinical Procedures") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_ClinicalProcedures = Rating, Deviation_ClinicalProcedures = Deviation, Volatility_ClinicalProcedures = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Contrast Bolus") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_ContrastBolus = Rating, Deviation_ContrastBolus = Deviation, Volatility_ContrastBolus = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Parameters and Trade-offs") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_ParametersAndTradeOffs = Rating, Deviation_ParametersAndTradeOffs = Deviation, Volatility_ParametersAndTradeOffs = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Pathology") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Pathology = Rating, Deviation_Pathology = Deviation, Volatility_Pathology = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Patient Preperation and Care") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_PatientPreparationAndCare = Rating, Deviation_PatientPreparationAndCare = Deviation, Volatility_PatientPreparationAndCare = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Patient Screening") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_PatientScreening = Rating, Deviation_PatientScreening = Deviation, Volatility_PatientScreening = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    
    tmp <- glicko2(subdat %>% 
                     filter(category == "Safety") %>%
                     select(Week,Person,Question,Score), 
                   status = questions %>% rename(Player = Question))$ratings %>%
      select(Player,Rating,Deviation,Volatility) %>%
      filter(str_starts(Player,"p_")) %>%
      rename(Person = Player)
    
    persons <- persons %>%
      left_join(tmp) %>%
      rename(Rating_Safety = Rating, Deviation_Safety = Deviation, Volatility_Safety = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))

    
    plot3.1 <- ggplot(persons, aes(x=Rating_Total)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Total"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Conceptual knowledge")
    
    plot3.1
    
    
    plot3.2 <- ggplot(persons, aes(x=Rating_Anatomy)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Anatomy"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Anatomy knowledge") 
    
    plot3.2
    
    plot3.3 <- ggplot(persons, aes(x=Rating_Angiography)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Angiography"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Angiography knowledge") 
    
    plot3.3
    
    plot3.4 <- ggplot(persons, aes(x=Rating_Artifacts)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Artifacts"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Artifacts knowledge") 
    
    plot3.4
    
    
    plot3.5 <- ggplot(persons, aes(x=Rating_ClinicalProcedures)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_ClinicalProcedures"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("ClinicalProcedures knowledge") 
    
    plot3.5
    
    plot3.6 <- ggplot(persons, aes(x=Rating_ContrastBolus)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_ContrastBolus"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("ContrastBolus knowledge") 
    
    plot3.6
    
    
    plot3.7 <- ggplot(persons, aes(x=Rating_ParametersAndTradeOffs)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_ParametersAndTradeOffs"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("ParametersAndTradeOffs knowledge") 
    
    plot3.7
    
    
    plot3.8 <- ggplot(persons, aes(x=Rating_Pathology)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Pathology"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Pathology knowledge") 
    
    plot3.8
    
    
    plot3.9 <- ggplot(persons, aes(x=Rating_PatientPreparationAndCare)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_PatientPreparationAndCare"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("PatientPreparationAndCare") 
    
    plot3.9
    
    
    plot3.10 <- ggplot(persons, aes(x=Rating_PatientScreening)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_PatientScreening"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("PatientScreening knowledge") 
    
    plot3.10
    
    
    plot3.11 <- ggplot(persons, aes(x=Rating_Safety)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Safety"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Safety knowledge") 
    
    plot3.11
    
    
    plot3.12 <- ggplot(persons, aes(x=Rating_Cardiac)) + 
      geom_density() + geom_vline(aes(xintercept=persons[persons$Person == person_id, "Rating_Cardiac"]),
                                  color="blue", linetype="dashed", size=1)+
      ggtitle("Cardiac knowledge") 
    
    plot3.12
    
    ggarrange(plot3.1, plot3.2, plot3.3,plot3.4,plot3.5,plot3.6,plot3.7,plot3.8,plot3.9,plot3.10,plot3.11,
              # labels = c("A", "B", "C"),
              ncol = 3, nrow = 4, title=sprintf("Person: %s", person_id))%>%
      ggsave(filename = "public/person.png", units =  "px", width = 1200,
             height = 1000,dpi = 100)
      # ggexport(filename = "public/person.png",  width = 1200,
      #          height = 1000,)
      # 
    
return(200)

  # },
  # #if an error occurs, tell me the error
  # error=function(e) {
  #   return(503)

  # })
  
}

# 

# res <-run('p_306')

