CREATE TABLE `ebdb`.`users` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `phoneNumber` VARCHAR(15) NOT NULL,
  `password` CHAR(95) NOT NULL,
  `verified` TINYINT NOT NULL DEFAULT 0,
  `friendsIDs` INT NULL,
  `numRequests` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) VISIBLE,
  UNIQUE (phoneNumber)
  );
