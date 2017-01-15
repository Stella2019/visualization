UPDATE SharedAudienceUser
SET Correction100k = GREATEST(FollowersRetrieved, FollowersActual) / FollowersRetrieved
WHERE UserID > 0