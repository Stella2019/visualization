
function TimeseriesModel (app) {
    this.app = app;
    this.connection = new Connection();
    
    this.events = {};
    this.events_arr = [];
    this.event_names = [];
    
    this.event = {};
}
TimeseriesModel.prototype = {
    setTriggers: function() {
        triggers.on('new_event', this.setEvent.bind(this));
    },
    loadEvents: function () {
        // Event selection
        this.connection.php('collection/getEvent', {},
                     this.parseEventsFile.bind(this));
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
            event.Keywords = event.Keywords.trim().split(/,[ ]*/);
            event.OldKeywords = event.OldKeywords.trim().split(/,[ ]*/);
            if (event.OldKeywords.length == 1 && event.OldKeywords[0] == "")
                event.OldKeywords = [];
            
            // Name
            if (!('DisplayName' in event) || !event['DisplayName'] || event['DisplayName'] == "null")
                event.DisplayName = event.Name;
               
            // Time
            event.StartTime = util.date(event.StartTime);
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
        
        triggers.emit("new_events");
        
//        options.buildEvents();
//
//        // Initialize Legend
//        legend = new Legend();
//        legend.init();
//
//        data.setEvent();
        this.setEvent();
    },
    setEvent: function () {
        var event_id = this.app.ops['Dataset']['Event'].get();
        this.event = this.events[parseInt(event_id)];
        triggers.emit("new_event", this.event);
        
        // Save times for the collection
        global_min_id = this.event.FirstTweet || 0;
        global_max_id = this.event.LastTweet || 1e20;
        
//        data.time.event_min = new Date(data.event.StartTime);
//        if(data.event.StopTime == "Ongoing") {
//            data.time.event_max = new Date();
//        } else {
//            data.time.event_max = new Date(data.event.StopTime);
//        }
        options.configureLoadTimeWindow(); // TODO
        
        data.loadEventTimeseries();
    },
};