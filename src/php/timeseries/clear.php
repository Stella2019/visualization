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
    assert("in_array('$collection', array('event', 'subset'))");
    assert("is_numeric($collection_id)");

    # Run Query
    $query = "CALL clear_timeseries_for_${collection}" . 
        "($collection_id);";

    include '../printJSON.php';
?>