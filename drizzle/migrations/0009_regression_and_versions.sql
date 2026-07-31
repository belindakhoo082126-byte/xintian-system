-- AI Regression Test Tables
CREATE TABLE `regression_sets` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(100),
  `isEnabled` boolean DEFAULT true NOT NULL,
  `createdBy` varchar(255) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `regression_questions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `setId` int NOT NULL,
  `question` text NOT NULL,
  `expectedSource` varchar(50),
  `expectedKeywords` text,
  `expectedReply` text,
  `category` varchar(100),
  `priority` enum('low','medium','high') DEFAULT 'medium' NOT NULL,
  `isEnabled` boolean DEFAULT true NOT NULL,
  `sortOrder` int DEFAULT 0 NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `regression_runs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `setId` int NOT NULL,
  `versionId` int,
  `isBaseline` boolean DEFAULT false NOT NULL,
  `baselineRunId` int,
  `status` enum('running','completed','failed') DEFAULT 'running' NOT NULL,
  `totalQuestions` int DEFAULT 0 NOT NULL,
  `passedCount` int DEFAULT 0 NOT NULL,
  `failedCount` int DEFAULT 0 NOT NULL,
  `accuracy` decimal(5,2) DEFAULT '0' NOT NULL,
  `avgProcessingMs` int DEFAULT 0 NOT NULL,
  `newHits` int DEFAULT 0 NOT NULL,
  `lostHits` int DEFAULT 0 NOT NULL,
  `sourceChanged` int DEFAULT 0 NOT NULL,
  `replyChanged` int DEFAULT 0 NOT NULL,
  `noMatchIncreased` int DEFAULT 0 NOT NULL,
  `noMatchDecreased` int DEFAULT 0 NOT NULL,
  `handoverIncreased` int DEFAULT 0 NOT NULL,
  `llmIncreased` int DEFAULT 0 NOT NULL,
  `llmDecreased` int DEFAULT 0 NOT NULL,
  `runBy` varchar(255) NOT NULL,
  `errorMessage` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `completedAt` timestamp
);

CREATE TABLE `regression_run_details` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `runId` int NOT NULL,
  `questionId` int NOT NULL,
  `question` text NOT NULL,
  `finalSource` varchar(50) NOT NULL,
  `matchedRuleId` int,
  `matchedKnowledgeId` int,
  `matchedProductId` int,
  `aiReply` text,
  `shouldHandover` boolean DEFAULT false NOT NULL,
  `processingTimeMs` int,
  `llmCalled` boolean DEFAULT false NOT NULL,
  `processingSteps` json,
  `baselineSource` varchar(50),
  `baselineReply` text,
  `baselineRuleId` int,
  `baselineKnowledgeId` int,
  `baselineProductId` int,
  `baselineIsHandover` boolean,
  `isPassed` boolean DEFAULT false NOT NULL,
  `differences` json,
  `suggestion` text,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- AI Version Management Table
CREATE TABLE `ai_versions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `versionNumber` varchar(50) NOT NULL,
  `label` varchar(255),
  `description` text,
  `knowledgeCount` int DEFAULT 0 NOT NULL,
  `ruleCount` int DEFAULT 0 NOT NULL,
  `personaId` int,
  `personaSnapshot` json,
  `knowledgeSnapshot` json,
  `rulesSnapshot` json,
  `regressionRunId` int,
  `regressionAccuracy` decimal(5,2),
  `status` enum('draft','published','archived') DEFAULT 'draft' NOT NULL,
  `publishedBy` varchar(255),
  `publishedAt` timestamp,
  `createdBy` varchar(255) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);
