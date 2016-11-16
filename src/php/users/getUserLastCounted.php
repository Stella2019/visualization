<?php
    include '../connect.php';

    # Get Variables
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection = ucfirst($_REQUEST['Collection']);
    $collection_id = $_REQUEST['ID'];

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection', array('Event', 'Subset'))");
    assert("is_int($collection_id)");

    // Execute Query
    $query = "SELECT MAX(LastTweetID) FROM UserIn$collection WHERE ${collection}ID=$collection_id;";

    include '../printJSON.php';
?>