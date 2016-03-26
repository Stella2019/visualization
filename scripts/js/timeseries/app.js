// Structure that will be used throughout the other data
var options, legend, disp, data, pipeline, TS;

function Pipeline() {
    this.progress = null;
    this.current_stage = -1;
    
    this.stages = [{ // parseCSVData / Load Collection
        name: 'Parse Loaded Collection Data',
        callback: data.parseLoadedTimeseries
    },{
        name: 'Reset Plot Area',
        callback: disp.resetPlotArea
    },{
        name: 'Initialize Series Data',
        callback: data.initializeSeries
    },{ // Prepare Data
        name: 'Find Which Data is Shown',
        callback: data.recalculateShown
    },{
        name: 'Calculate Timeseries',
        callback: data.getCategorySubtotals
    },{
        name: 'Order Timeseries',
        callback: data.orderSeries
    },{
        name: 'Prepare Timeseries Data for Chart',
        callback: data.makeChartTimeseries
    },{
        name: 'Ready Context Chart',
        callback: disp.contextChart
    },{
        name: 'Set Focus Axis Labels',
        callback: disp.setFocusAxisLabels
    },{
        name: 'Set Colors',
        callback: disp.setColors
    },{ // Display
        name: 'Configure Plot Area',
        callback: disp.configurePlotArea
    },{
        name: 'Build Timeseries Paths',
        callback: disp.buildTimeseries
    },{
        name: 'Draw Timeseries',
        callback: disp.drawTimeseries
    }];
}
Pipeline.prototype = {
    start: function(stage) {
        if(this.current_stage > 0) {
            // Need to interrupt the past pipeline? or just keep on going?
        }
        
        // Get what stage we are at
        if(stage) {
            this.current_stage = this.stages.reduce(function(cur, cand, i) {
                if(cand.name == stage)
                    return i;
                return cur;
            }, 0)
        } else {
            this.current_stage = 0;
        }
        
        // Make a new progress bar
        if(this.progress) {
            this.progress.end();
        }
        this.progress = new Progress({
            name: 'pipeline',
            steps: this.stages.length
        });
        this.progress.start();
        this.progress.bar_div.classed("progress-bar-info", true);
        
        // Start the next stage
        this.nextStage();
    },
    nextStage: function() {
        if(this.current_stage < 0) {
            this.abort();
            return;
        } else if(this.current_stage >= this.stages.length) {
            this.finish();
            return;
        }
        
        var stage = this.stages[this.current_stage];
        this.progress.update(this.current_stage + 1, stage.name);
        
        // Call the function of this stage
        setTimeout(function() { // Pause for a bit to let the progress bar update
            var start = new Date().getTime();
            stage.callback();
            var stop = new Date().getTime();
            
            // Go to the next stage
            this.current_stage = this.current_stage + 1;
            this.nextStage();
        }.bind(this), 5);
    },
    abort: function() {
        this.progress.end();
        this.current_stage = -2;
    },
    finish: function() {
        this.progress.end();
        this.current_stage = 0;
    }
};

function Timeseries () {
    this.disp = new TimeseriesDisplay(this);
    this.model = new TimeseriesModel(this);
    this.ops = new Options();
    this.tooltip = new Tooltip();
}
Timeseries.prototype = {
    setTriggers: function() {
        triggers.on("timeseries:new_events", this.populateEventOptions.bind(this));
        
        this.disp.setTriggers();
        this.model.setTriggers();
    },
    setOptions: function() {
        this.ops.panels = ['Dataset', 'View', 'Series', 'Analysis'];
        var options = this.ops;
        
        this.ops['Dataset'] = {
            'Event Type': new Option({
                title: "Type",
                labels: ["All", "Other Type"],
                ids:    ["All", "Other Type"],
                default: 0,
                custom_entries_allowed: true,
                callback: function() { options.chooseCollectionType(); }
            }),
            Event: new Option({
                title: "Event",
                labels: ["none"],
                ids:    ["none"],
                default: 0,
                custom_entries_allowed: true,
                callback: function() { data.setCollection(); },
                edit: function() { options.editWindow('collection');  }
            }),
            Rumor: new Option({
                title: 'Rumor',
                labels: ["- None -", "- New -"],
                ids:    ["_none_", "_new_"],
                default: 0,
                type: "dropdown",
                callback: function() { data.getRumor(); },
                edit: function() { options.editWindow('rumor'); }
            }),
            'Time Window': new Option({
                title: "Time",
                labels: ["First Day", "First 3 Days", "Whole Collection", "Custom",],
                ids:    ['1d', '3d', 'all', 'custom'],
                default: 0,
                callback: function() { 
                    if(options['Dataset']['Time Window'].is('custom')) {
                        options.editLoadTimeWindow();
                    } else {
                        options.configureLoadTimeWindow();
                        data.loadCollectionData();
                    }
                },
                edit: function() { options.editLoadTimeWindow(); }
            }),
            'Time Min': new Option({
                title: "Time Min",
                labels: [''],
                ids: [''],
                date: new Date(),
                default: 0,
                hidden: true,
                custom_entries_allowed: true
            }),
            'Time Max': new Option({
                title: "Time Max",
                labels: [''],
                ids: [''],
                date: new Date(),
                default: 0,
                hidden: true,
                custom_entries_allowed: true
            })
        };
        this.ops['View'] = {
            'Plot Type': new Option({
                title: "Plot Type",
                labels: ["Stacked", "Overlap", "Lines", "Stream", "Separate", "100%"],
                ids:    ["stacked", "overlap", "lines", "stream", "separate", "percent"],
                default: 0,
                callback: function () {
                    pipeline.start('Prepare Timeseries Data for Chart');
                }
            }),
            Resolution: new Option({
                title: "Resolution",
                labels: ["Day", "Hour", "10 Minutes", "Minute"],
                ids:    ["day", "hour", "tenminute", "minute"],
                default: 2,
                callback: function () {
                    pipeline.start('Calculate Timeseries');
                }
            }),
            Shape: new Option({
                title: "Shape",
                labels: ["Linear",  "Basis",        "Step"],
                ids:    ["linear",  "basis-open",   "step-before"],
                default: 2,
                callback: function () { 
                    pipeline.start('Ready Context Chart');
                }
            }),
            'Y Scale': new Option({
                title: "Y Scale",
                labels: ["Linear",  "Power", "Log", "Preserve"],
                ids:    ["linear",  "pow",   "log", "preserve"],
                default: 0,
                callback: function () {
                    pipeline.start('Configure Plot Area')
                }
            }),
            'Y Max': new Option({
                title: "Y Max",
                labels: [0],
                ids:    [0],
                default: 0,
                type: "textfieldautoman",
                custom_entries_allowed: true,
                callback: function() {
                    pipeline.start('Configure Plot Area')
                }
            }),
            'Color Scale': new Option({
                title: "Color Scale",
                labels: ["10", "20", "20b", "20c"],
                ids:    ["category10", 'category20', 'category20b', 'category20c'],
                default: 1,
                callback: function() {
                    pipeline.start('Set Colors');
                }
            }),
            'Total Line': new Option({
                title: "Show Total Line",
                styles: ["btn btn-sm btn-default", "btn btn-sm btn-primary"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { 
                    disp.alert('Sorry this is broken right now');
                    pipeline.start('Configure Plot Area');
                }
            }),
//            'Time Saving': new Option({
//                title: "Save Time State",
//                labels: ["No", 'Yes'],
//                ids:    ["false", "true"],
//                default: 0,
//                type: "toggle",
//                parent: '#choices_time_right_buttons',
//                callback: function() { 
//                    var saving = !(options.time_save.is("true"));
//                    if(saving) {
//                        if(options.record.indexOf('time_min') == -1)
//                            options.record.push('time_min');
//                        if(options.record.indexOf('time_max') == -1)
//                            options.record.push('time_max');
//                    } else {
//                        if(options.record.indexOf('time_min') > -1)
//                            options.record.splice(options.record.indexOf('time_min'), 1);
//                        if(options.record.indexOf('time_max')>  -1)
//                            options.record.splice(options.record.indexOf('time_max'), 1);
//                    }
//                }
//            }),
            'Time Min': new Option({
                title: "Begin",
                labels: ["2000-01-01 00:00"],
                ids:    [new Date("2000-01-01 00:00")],
                default: 0,
                custom_entries_allowed: true,
                parent: '#chart-bottom',
                no_render: true,
                callback: function() { disp.setFocusTime('input_field'); }
            }),
            'Time Max': new Option({
                title: "End",
                labels: ["2000-01-01 00:00"],
                ids:    [new Date("2000-01-01 00:00")],
                default: 0,
                custom_entries_allowed: true,
                parent: '#chart-bottom',
                no_render: true,
                callback: function() { disp.setFocusTime('input_field'); }
            })
        };
        this.ops['Series'] = {
            'Chart Category': new Option({
                title: 'Show in Chart',
                labels: ["Tweet Types", "Distinctiveness", "Found Ins", "Keywords"],
                ids:    ["Tweet Type", "Distinctiveness", "Found In", "Keyword"],
                default: 3,
                type: "dropdown",
                callback: function() { 
                    pipeline.start('Prepare Timeseries Data for Chart');
                }
            }),
            Order: new Option({
                title: "Order Series by",
                labels: ["Original", "Alphabet", "Type", "Volume"],
                ids:    ["orig", "alpha", "type", "volume"],
                default: 3,
                callback: function() { 
                    pipeline.start('Order Timeseries');
                }
            }),
            'Add Term': new Option({
                title: "Add Term",
                labels: ["New Term"],
                ids:    ["new"],
                default: 0,
                custom_entries_allowed: true,   
                type: "textfieldconfirm",
                callback: function() {
                    data.genTweetCount(
                        options['Series']['Add Term'].get().toLowerCase()
                    ); 
                }
            }),
            'Clean Legend': new Option({
                title: "Clean Up Legend",
                styles: ["btn btn-sm btn-default", "btn btn-sm btn-primary"],
                labels: ["No", 'Yes'],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { legend.showOrHideAll(); }
            })
//            'Shown': new Option({
//                title: "Terms Selected",
//                labels: [""],
//                ids:    [''],
//                available: [0],
//                default: 0,
//                custom_entries_allowed: true, 
//                parent: '#choices_legend',
//                callback: function() { pipeline.start('Find Which Data is Shown'); }
//            })
        };     
        this.ops['Analysis'] = {
            'Fetched Tweet Order': new Option({
                title: 'Fetched Tweets Order',
                labels: ["Prevalence", "Time", "Random"],
                ids:    ["prevalence", "time", "rand"],
                default: 1,
                type: "dropdown",
                callback: function() { /* nothing */ }
            }),
            'N-Gram View': new Option({
                title: 'Fetch NGrams',
                labels: ["Whole Event"],
                ids:    ["e_event"],
                default: 0,
                type: "dropdown",
                callback: function() { data.calculateNGrams('ngram_view'); }
            }),
            'N-Gram Compare': new Option({
                title: 'compare w/',
                labels: ['-', 'Whole Event'],
                ids:    ['', 'e_event'],
                default: 0,
                type: "dropdown",
                callback: function() { data.calculateNGrams('ngram_cmp'); }
            })
        };
        
        this.ops.updateCollectionCallback = function() { data.loadRumors(); };
        this.ops.init();
    },
    populateEventOptions: function() {
        var event_op = this.ops['Dataset']['Event'];
        var event_type_op = this.ops['Dataset']['Event Type'];
        
        // Generate Collections List
        event_op['labels'] = this.model.event_names;
        event_op['ids'] = this.model.events_arr.map(function(event) { return event['ID']; });
        event_op['available'] = util.range(this.model.events_arr.length);
        
        // Find the current collection
        var cur = event_op.get();
        event_op.default = this.model.events_arr.reduce(function(candidate, event, i) {
            if(event['ID'] == cur)
                return i;
            return candidate;
        }, 0);
        event_op.set(event_op['ids'][event_op.default]);
        
        // Make the dropdown
        this.ops.buildSidebarOption('Dataset', 'Event');
        this.ops.recordState(true);
        
        // Generate Types of Collections
        var types = util.lunique(this.model.events_arr.map(function(event) { return event['Type']; }));
        types.unshift('All'); // Add 'All' to begining
        
        event_type_op['labels'] = types;
        event_type_op['ids'] = types;
        event_type_op['available'] = util.range(types.length);
        
        // Set the type to match the current collection
        event_type_op.default = event_type_op['ids'].indexOf(this.model.events_arr[event_op.default]['Type']);
        event_type_op.set(types[event_type_op.default]);
        
        // Make the dropdown for collection types
        this.ops.buildSidebarOption('Dataset', 'Event Type');
        this.ops.recordState(true);

        // Add additional information for collections
        this.model.events_arr.forEach(function(event) {
            var id = '#Event_' + event['ID'];
            this.tooltip.attach(id, function(d) {
                return this.model.events_arr[d];
            }.bind(this));
        }, this);
        
        // Limit the collection selections to the particular type
        this.chooseEventType();
    },
    chooseEventType: function() {
        var event_op = this.ops['Dataset']['Event'];
        var curType = this.ops['Dataset']['Event Type'].get();
        var curEvent = event_op.get();
        var firstValid = -1; 
        
        this.model.events_arr.map(function(event, i) {
            if(event['Type'] == curType || 'All' == curType) {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'block');
                
                if(firstValid == -1)
                    firstValid = i;
            } else {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'none');
                
                if(event['ID'] == curEvent)
                    curEvent = 'invalid';
            }
        });
        
        // If the current collection does not match this type, then make a new one
        if(curEvent == 'invalid') {
            event_op.set(event_op.ids[firstValid]);
                        
            d3.select('#choose_Event').select('.current')
                .text(event_op.getLabel());

            this.ops.recordState(true);

            this.model.setEvent();
        }
    },
};

function initialize() {
    TS = new Timeseries();
    
    TS.setTriggers();
    
    TS.disp.buildPage();
    TS.tooltip.init();
    TS.setOptions();
    
    // Start loading data
    TS.model.loadEvents();
    
//    pipeline = new Pipeline();
//    data.loadEventTimeseries();
}

window.onload = initialize;