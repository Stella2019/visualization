INSERT INTO SharedAudienceUser (UserID, inCN15719)
SELECT UserID, 1 as 'inCN15719'
FROM UserInSubset WHERE SubsetID = 2637
ON DUPLICATE KEY UPDATE inCN15719 = 1 