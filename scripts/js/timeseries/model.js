
function TimeseriesModel (app) {
    this.app = app;
    this.connection = new Connection();
    
    this.events = {};
    this.events_arr = [];
    this.event_names = [];
    
    this.subsets = {};
    this.subsets_arr = [];
    
    this.event = {};
    this.time = {
        name: "Time",
        event_min: new Date(),
        event_max: new Date(),
        min: new Date(), // of possible data
        max: new Date(), // of possible data
        stamps: [],
        stamps_nested: [],
        stamps_nested_int: [],
        nested_min: new Date(),
        nested_max: new Date(),
        data_index: 4
    };
    
    this.init();
}
TimeseriesModel.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event:updated', this.loadEventTimeseries.bind(this));
        triggers.on('subset:updated', this.loadSubsetTimeseries.bind(this));
    },
    loadEventTimeseries: function() {
        console.log('Load Event Timeseries: TODO');
    },
    loadSubsetTimeseries: function() {
        console.log('Load Subset Timeseries: TODO');
    },
};