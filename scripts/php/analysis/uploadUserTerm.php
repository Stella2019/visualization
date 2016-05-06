<?php
    include '../connect.php';
    
    $event = $_REQUEST['Event'];
    $subset = $_REQUEST['Subset'];
    $user = $_REQUEST['User'];
    $term = $_REQUEST['Term'];

    if(isset($_REQUEST['Count'])) { // Lexicon Term
        $count = $_REQUEST['Count'];
        $query = "INSERT IGNORE INTO UserLexicon " .
            " (Event, Subset, User, Term, Count) " .
            " VALUES ($event, $subset, $user, '$term', $count)";
    } else {
        $query = "INSERT IGNORE INTO UserDescriptionUnigram " .
            " (Event, Subset, User, Term) " .
            " VALUES ($event, $subset, $user, '$term')";
    }

    $result = $mysqli->query($query);

    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result);
    }

    $mysqli->close();
?>