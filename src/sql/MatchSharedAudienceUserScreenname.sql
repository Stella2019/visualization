SET SQL_SAFE_UPDATES = 0;

UPDATE SharedAudienceUser SAU
INNER JOIN UserInSubset UIS
	ON SAU.UserID = UIS.UserID
    AND UIS.SubsetID=2637
INNER JOIN TweetUser
	ON UIS.FirstTweetID = TweetUser.Tweet
SET SAU.Screenname = TweetUser.Screenname