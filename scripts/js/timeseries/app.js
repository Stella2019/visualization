// Structure that will be used throughout the other data
var options, legend, pipeline, TS;

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
    this.ops = new Options(this);
    this.modal = new Modal(this);
    this.tooltip = new Tooltip();
    this.connection = new Connection();
    
    this.collection = new CollectionManager(this);
    this.model = new TimeseriesModel(this);
    this.view = new TimeseriesView(this); // may be considered redundant
    this.focus = new TimeseriesChart(this, 'focus');
    this.context = new TimeseriesChart(this, 'context');
    this.legend = new TimeseriesLegend(this);
}
Timeseries.prototype = {
    setOptions: function() {
        this.ops.panels = ['Dataset', 'View', 'Series', 'Analysis'];
        var options = this.ops;
        
        this.ops['Dataset'] = { };
        this.ops['View'] = {
            'Plot Type': new Option({
                title: "Plot Type",
                labels: ["Stacked", "Overlap", "Lines", "Stream", "Separate", "100%"],
                ids:    ["stacked", "overlap", "lines", "stream", "separate", "percent"],
                default: 0,
                callback: triggers.emitter('chart:render series')
//                function () {
//                    pipeline.start('Prepare Timeseries Data for Chart');
//                }
            }),
            Resolution: new Option({
                title: "Resolution",
                labels: ["Day", "Hour", "10 Minutes", "Minute"],
                ids:    ["day", "hour", "tenminute", "minute"],
                default: 2,
                callback: triggers.emitter('chart:context time')
            }),
            Shape: new Option({
                title: "Shape",
                labels: ["Linear",  "Basis",        "Step"],
                ids:    ["linear",  "basis-open",   "step-before"],
                default: 2,
                callback: triggers.emitter('chart:shape')
//                function () { 
//                    pipeline.start('Ready Context Chart');
//                }
            }),
            'Y Scale': new Option({
                title: "Y Scale",
                labels: ["Linear",  "Power", "Log"],
                ids:    ["linear",  "pow",   "log"],
                default: 0,
                callback: triggers.emitter('chart:y-scale')
//                callback: function () {
//                    pipeline.start('Configure Plot Area')
//                }
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
                    triggers.emit('alert', 'Sorry this feature is broken right now.');
//                    pipeline.start('Configure Plot Area'); TODO
                }
            }),
            'Time Min': new Option({
                title: "Begin",
                labels: ["2000-01-01 00:00"],
                ids:    [new Date("2000-01-01 00:00")],
                default: 0,
                custom_entries_allowed: true,
                parent: '#chart-bottom',
                render: false,
                callback: triggers.emitter('chart:focus time')
            }),
            'Time Max': new Option({
                title: "End",
                labels: ["2000-01-01 00:00"],
                ids:    [new Date("2000-01-01 00:00")],
                default: 0,
                custom_entries_allowed: true,
                parent: '#chart-bottom',
                render: false,
                callback: triggers.emitter('chart:focus time')
            })
        };
        this.ops['Series'] = {
            'Tweet Types': new Option({
                title: 'Tweet Types',
                labels: ['Any', 'Split', 'Originals', 'Retweets', 'Replies', 'Quotes'],
                ids:    ['any', 'split', 'original', 'retweet', 'reply', 'quote'],
                default: 0,
                callback: triggers.emitter('timeseries:ready')
            }),
            Unit: new Option({
                title: 'Unit',
                labels: ['Count of Tweets', 'Count of Distinct', 'Exposure'],
                ids:    ['count', 'distinct', 'exposure'],
                default: 0,
                callback: triggers.emitter('timeseries:ready')
            }),
            Order: new Option({
                title: "Order Legend by",
                labels: ["Original", "Alphabet", "Volume Visible", 'Volume Overall'],
                ids:    ["orig", "alpha", 'volume shown', 'volume'],
                default: 3,
                callback: function() { 
                    pipeline.start('Order Timeseries');
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
//            'N-Gram View': new Option({
//                title: 'Fetch NGrams',
//                labels: ["Whole Event"],
//                ids:    ["e_event"],
//                default: 0,
//                type: "dropdown",
//                callback: function() { data.calculateNGrams('ngram_view'); }
//            }),
//            'N-Gram Compare': new Option({
//                title: 'compare w/',
//                labels: ['-', 'Whole Event'],
//                ids:    ['', 'e_event'],
//                default: 0,
//                type: "dropdown",
//                callback: function() { data.calculateNGrams('ngram_cmp'); }
//            })
        };
        
        // Add dataset options
        triggers.emit('collectionManager:setOptions');
        
//        this.ops.updateCollectionCallback = function() { data.loadRumors(); }; // TODO fix this
        this.ops.init();
    },
};

function initialize() {
    TS = new Timeseries();
    
    TS.setOptions();
    TS.view.buildPage();
    TS.tooltip.init();
    
    // Start loading data
    triggers.emit('modal:build');
    triggers.emit('chart:build');
    triggers.emit('collectionManager:build');
    
//    pipeline = new Pipeline();
//    data.loadEventTimeseries();
}

window.onload = initialize;