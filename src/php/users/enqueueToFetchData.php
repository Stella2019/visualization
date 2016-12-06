<?php
    include '../connect.php';

    # Get Variables
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection = strtolower($_REQUEST['Collection']);
    $collection_id = $_REQUEST['ID'];

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection', array('subset'))"); # Does not support events right now -- too many
    assert("is_numeric($collection_id)");

    # Execute Query
    $query = "CALL enqueue_users_in_${collection}_to_fetch_user_data_queue(${collection_id});";

    include '../printJSON.php';
?>