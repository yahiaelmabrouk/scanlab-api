library(RPostgres)
library(stringr)
library(dbplyr)
library(tidyverse)
library(PlayerRatings)
library(ggplot2)
library(GGally)
library(profvis)

run <- function(cohort_id){
  #########################################################
  ## Get data from database
  #
  tryCatch( {
    
    library(RPostgres)
    library(stringr)
    library(dbplyr)
    library(tidyverse)
    library(PlayerRatings)
    library(ggplot2)
    library(GGally)
    
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
                     /Users/dyada/Desktop/project_R_REST_API_node_integration/scanlab-api/r/skillAssessmentCohortScript.R
                     /Users/dyada/Desktop/project_R_REST_API_node_integration/scanlab-api/r/skillAssessmentCohortScriptPlotly.R
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
   
    ###############################################
    ## Glicko analysis
    
    
    
    ##############################################
    ## Cohort focus
    cohortFocusLong  = cohorts[cohorts$id == cohort_id, 'name']
    cohortFocusShortDict = list("UNC - Jan. 2023"="UNC 2023", "Essen-Freiburg"="Essen-Freiburg", "Alliance Hiring Tool Pilot"="Alliance",
                                'Demo Accounts'='Demo', 'Test 2022'='Test 2022', 'Wake Radiology ' ='Wake Radiology',
                                'MR Assessment - Test Cohort' = 'MR Assessment', 'Validation Pilot Study'='Validation Pilot Study',
                                'Clinical Validation Study (Pilot)'='Pilot', 'Test Cohort'='Test Cohort', 'UofL Health - Skill Assessment (2022)'='UofL Health 2022',
                                'Nebraska Methodist Health System - Skill Assessments 2023'='Nebraska Methodist 2023', 'Wake Tech Radiology - Hiring 2023'='Wake Tech 2023',
                                '3H Vision - MR Assessments'='Vision', 'MASTER TEST COHORT'='MASTER TEST', 'University Essen - Skill Assessment 2023' = 'University Essen 2023')
    
    cohortFocusShort = as.character(cohortFocusShortDict[cohortFocusLong])
    cohortFocusLong
    cohortFocusShort
    
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
    
    plot1 <- ggplot(questions,aes(x=Question,y=Rating,
                                  ymin=Rating-Deviation, ymax=Rating+Deviation,
                                  fill = Volatility, color = Volatility)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      theme(axis.text.x = element_blank()) +
      geom_crossbar() + 
      geom_point(color="gray") +
      ylab("Difficulty Rating (AU)") +
      ggtitle("Difficulty rating for all conceptual questions")  
    plot1
    
    questions <- questions %>%
      separate(Question, c(NA,"QuestionID"), remove = FALSE, convert = TRUE) %>%
      left_join(multipleChoiceQuestions,by = c("QuestionID"="id")) %>%
      select("Question","Rating","Deviation","Volatility","difficulty")
    
    plot2 <- ggplot(questions,aes(x=Question,y=Rating,
                                  ymin=Rating-Deviation, ymax=Rating+Deviation,
                                  fill = difficulty, color = difficulty)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point() +
      ggtitle("Difficulty rating for all conceptual questions with maunal difficulty assessment")  
    plot2
    
    persons <- persons %>%
      left_join(subdat %>% 
                  select(Person,cohort) %>%
                  unique()) %>%
      left_join(users %>% 
                  select(Person, legalName) %>%
                  unique()) %>%
      mutate(username = ifelse(cohort == cohortFocusLong, legalName, NA)) %>%
      mutate(cohort = ifelse(cohort == cohortFocusLong, cohortFocusShort,NA)) %>%
      mutate(Person = fct_reorder(Person,Rating))
    persons
    
    plot3 <- ggplot(persons,aes(x=Person,y=Rating, shape = username,
                                ymin=Rating-Deviation, ymax=Rating+Deviation,
                                fill = Volatility, color = Volatility)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point(size = 4, color = "gray") + 
      ggtitle(sprintf("Conceptual knowledge rating for all persons Cohort: %s", cohortFocusLong)) +
      theme(axis.text.x = element_text(angle = 90,vjust=0.25))
    plot3
    ggsave(path = "public", filename = "plot3.png")
    
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

    ## not seen by users..
    plot4 <- ggplot(questions,aes(x=Question,y=Rating,
                                  ymin=Rating-Deviation, ymax=Rating+Deviation,
                                  fill = Volatility, color = Volatility)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      theme(axis.text.x = element_blank()) +
      geom_crossbar() + 
      geom_point(color = "gray", size = 3) +
      ylab("Difficulty rating (AU)") +
      ggtitle("Difficulty rating for all practical questions")  
    plot4
    
    ### Filter out here as well
    ## Augment persons with cohort and focus on specific cohort
    persons <- persons %>%
      left_join(subdat %>% 
                  select(Person,cohort) %>%
                  unique()) %>%
      left_join(users %>% 
                  select(Person, legalName) %>%
                  unique()) %>%
      mutate(username = ifelse(cohort == cohortFocusLong, legalName, NA)) %>%
      mutate(cohort = ifelse(cohort == cohortFocusLong,cohortFocusShort,NA)) %>%
      mutate(Person = fct_reorder(Person,Rating))
    persons
    ## need to filter for cohort
    plot5 <- ggplot(persons,aes(x=Person,y=Rating, shape = username,
                                ymin=Rating-Deviation, ymax=Rating+Deviation,
                                fill = Volatility, color = Volatility)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point(size = 4, color = "gray") + 
      # geom_hline(yintercept = quantile(persons$Rating,0.5), color='red') +
      geom_vline(xintercept = nrow(persons) /2, color='blue') +
      geom_vline(xintercept = nrow(persons)*1 /4, color='blue') +
      geom_vline(xintercept = nrow(persons)*3 /4, color='blue') +
      ggtitle(sprintf("Total skill rating for all persons Cohort: %s", cohortFocusLong)) +
      theme(axis.text.x = element_text(angle = 90,vjust=0.25)) 
    plot5
    
    ggsave(path = "public", filename = "plot5.png")

    
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
      left_join(users %>% 
                  select(Person, legalName) %>%
                  unique()) %>%
      mutate(username = ifelse(cohort == cohortFocusShort, legalName, NA)) %>%
      rename(Rating_Lumbar = Rating, Deviation_Lumbar = Deviation, Volatility_Lumbar = Volatility) %>%
      mutate(Person = fct_reorder(Person,Rating_Total))
    persons
    
    cohortFocusShort
    plot6 <- ggplot(persons,aes(x=Person, y=Rating_Brain, shape = username,
                                ymin=Rating_Brain-Deviation_Brain, 
                                ymax=Rating_Brain+Deviation_Brain,
                                fill = Volatility_Brain, color = Volatility_Brain)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point(size = 4, color = "gray") + 
      ggtitle(sprintf("Brain skill rating for all persons Cohort: %s", cohortFocusLong)) +
      theme(axis.text.x = element_text(angle = 90,vjust=0.25))
    plot6
    ggsave(path = "public", filename = "plot6.png")
    
    plot7 <- ggplot(persons,aes(x=Person, y=Rating_Knee, shape = username,
                                ymin=Rating_Knee-Deviation_Knee, 
                                ymax=Rating_Knee+Deviation_Knee,
                                fill = Volatility_Knee, color = Volatility_Knee)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point(size = 4, color = "gray") + 
      ggtitle(sprintf("Knee skill rating for all persons Cohort: %s", cohortFocusLong)) +
      theme(axis.text.x = element_text(angle = 90,vjust=0.25))
    plot7
    ggsave(path = "public", filename = "plot7.png")
    
    plot8 <- ggplot(persons,aes(x=Person, y=Rating_Lumbar, shape = username,
                                ymin=Rating_Lumbar-Deviation_Lumbar, 
                                ymax=Rating_Lumbar+Deviation_Lumbar,
                                fill = Volatility_Lumbar, color = Volatility_Lumbar)) +
      scale_fill_viridis_c(aesthetics = c("color","fill")) +
      geom_crossbar() + 
      geom_point(size = 4, color = "gray") + 
      ggtitle(sprintf("Lumbar skill rating for all persons Cohort: %s", cohortFocusLong)) +
      theme(axis.text.x = element_text(angle = 90,vjust=0.25))
    plot8
    ggsave(path = "public", filename = "plot8.png")
    
    ggsave(path = "public", filename = "glicko_analysis_cohort.png")
    return(200)

  },
  #if an error occurs, tell me the error
  error=function(e) {
    return(503)

  })
  
}
# 
# res <-profvis(run(37))
# res <-run(235) ## UoFL
# res <-run(160)
# res <-run(36)
# res$status
# res$output[7]

