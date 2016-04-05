
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
        triggers.on('new_event', this.setEvent.bind(this));
        triggers.on('edit_window:updated', this.updateCollection.bind(this));
        triggers.on('event:load_timeseries', this.loadEventTimeseries.bind(this));
        triggers.on('event_updated', this.loadSubsets.bind(this));
    },
    loadEvents: function () {
        // Event selection
        this.connection.php('collection/getEvent', {},
                     this.parseEventsFile.bind(this));
    },
    loadSubsets: function () {
        // Event selection
        this.connection.php('collection/getSubset', {event: this.event.ID},
                     this.parseSubsetsFile.bind(this));
    },
    parseEventsFile: function (data) {
        // Add events (collections)
        this.events_arr = JSON.parse(data);
        this.events_arr.sort(util.compareCollections);
        this.events_arr.reverse();
        
        this.events = {};
        this.events_arr.forEach(function(event) {
            this.events[event['ID']] = event;
        }, this);
        
        // Format collection data
        this.events_arr.forEach(function (event) {
            // Keywords
            event.Keywords = event['Keywords'] ? event.Keywords.trim().split(/,[ ]*/) : [];
            event.OldKeywords = event['OldKeywords'] ? event.OldKeywords.trim().split(/,[ ]*/) : [];
            if (event.OldKeywords.length == 1 && event.OldKeywords[0] == "")
                event.OldKeywords = [];
            
            // Name
            if (!('DisplayName' in event) || !event['DisplayName'] || event['DisplayName'] == "null")
                event.DisplayName = event.Name;
               
            // Time
            event.StartTime = event.StartTime ? util.date(event.StartTime) : new Date();
//            collection.StartTime.setMinutes(collection.StartTime.getMinutes()
//                                           -collection.StartTime.getTimezoneOffset());
            event.Month = util.date2monthstr(event.StartTime);
            if (event.StopTime) {
                event.StopTime = util.date(event.StopTime);
                if (event.StartTime.getMonth() != event.StopTime.getMonth() ) 
                    event.Month += ' to ' + util.date2monthstr(event.StopTime);
            } else {
                event.StopTime = "Ongoing";
                event.Month += '+';
            }
            event.DisplayName += ' ' + event.Month;
        });

        
        // Make nicer event names
        this.event_names = this.events_arr.map(function (event) {
            return event.DisplayName;
        });
        
        triggers.emit('new_events');
        
//        options.buildEvents();
//
//        // Initialize Legend
//        legend = new Legend();
//        legend.init();
//
//        data.setEvent();
//        triggers.emit('new_event', this.event);
    },
    setEvent: function () {
        var event_id = this.app.ops['Dataset']['Event'].get();
        this.event = this.events[parseInt(event_id)];
//        triggers.emit("new_event", this.event);
        
        // Save times for the collection
        this.time.event_min = new Date(this.event.StartTime);
        if(this.event.StopTime == "Ongoing") {
            this.time.event_max = new Date();
        } else {
            this.time.event_max = new Date(this.event.StopTime);
        }
        
        global_min_id = this.event.FirstTweet || util.timestamp2TwitterID(this.time.event_min);
        global_max_id = this.event.LastTweet  || util.timestamp2TwitterID(this.time.event_max);
        
        triggers.emit('global_time_set');
        
        triggers.emit('event_updated', this.event);
//        data.loadEventTimeseries(); // TODO
    },
    updateCollection: function() {
        var fields = {};
        $("#edit_form").serializeArray().forEach(function(x) { fields[x.name] = x.value; });
        
        Connection.php('collection/update', fields, triggers.emitter('edit_window_updated')); // add a callback
    },
    loadEventTimeseries: function() {
        console.log('TODO');
    },
    parseSubsetsFile: function(filedata) {
        try {
            filedata = JSON.parse(filedata);
        } catch (exception) {
            console.log(filedata);
            return;
        }
        
        this.subsets_arr = filedata;
        this.subsets_arr.forEach(function(subset) {
            subset.DisplayMatch = subset.Match.replace(/\\W/g, '<span style="color:#ccc">_</span>');
            
            this.subsets[subset.ID] = subset;
        }, this);
        
        triggers.emit('new_subsets', filedata);
        
        // Populate the list of options
//        options.buildRumors();
    },
//    setRumor: function() {
//        var rumor_id = options['Dataset']['Rumor'].get();
//        
//        data.rumor = data.rumors.reduce(function(rumor, candidate) {
//            if(rumor.ID == rumor_id)
//                return rumor;
//            return candidate
//        }, {});
//        
//        // No future callbacks from this
//    },
};