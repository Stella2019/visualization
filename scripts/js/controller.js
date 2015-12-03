function Controller(timeseriesModel) {
    model = new TimeSeriesData(this);
    view = new View(this);
}

Controller.prototype = {
    newDataset: function() {
        var selectedIndex = d3.select("select#chooseCollection").property('selectedIndex');
        var collection = this.model.collection_names[selectedIndex];
        var unique_suffix = this.view.options.subset.cur == "unique" ? "_unique" : "";
    },
    init: function() {
        this.view.init();
        this.view.buildInterface();
        
        this.model.loadCollections(
            {callback: this.view.populateCollectionList}
        );
        
        //changeData()
    }
}

window.onload = function() {
    var control = new Controller();

    control.init();
}