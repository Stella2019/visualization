<?php
    include '../connect.php';

    # Get Variables
    if(!isset($_REQUEST['collection_type']) or !isset($_REQUEST['collection_id'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection_type = strtolower($_REQUEST['collection_type']);
    $collection_id = $_REQUEST['collection_id'];

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection_type', array('event', 'subset'))");
    assert("is_numeric($collection_id)");

    # Run Query
    $query = "CALL delete_collection" . 
        "($collection_id, '$collection_type');";

    include '../printJSON.php';
?>