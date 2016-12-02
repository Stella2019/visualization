<?php
    include '../connect.php';

    # Get Variables
    if(!isset($_REQUEST['collection_type']) or !isset($_REQUEST['collection_id']) or !isset($_REQUEST['item_type'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection_type = strtolower($_REQUEST['collection_type']);
    $collection_id = $_REQUEST['collection_id'];
    $item_type = strtolower($_REQUEST['item_type']);

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection_type', array('event', 'subset'))");
    assert("is_numeric($collection_id)");
    assert("in_array('$item_type', array('tweets', 'timeseries', 'users'))");

    # Run Query
    $query = "CALL clear_items_in_collection" . 
        "($collection_id, '$collection_type', '$item_type');";

    include '../printJSON.php';
?>