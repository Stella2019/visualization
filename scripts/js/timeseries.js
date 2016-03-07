// Structure that will be used throughout the other data
var options, legend, disp, data, pipeline, TS;

function Timeseries () {
    
}
Timeseries.prototype = {
    setOptions: function() {
        options = new Options();
        options.panels = ['Dataset', 'View', 'Series', 'Analysis'];
        
        options['Dataset'] = {
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
        options['View'] = {
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
        options['Series'] = {
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
        options['Analysis'] = {
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
        
        options.updateCollectionCallback = function() { data.loadRumors(); };
        options.init();
    }
};

function initialize() {
    TS = new Timeseries();
    TS.setOptions();
    
    disp = new Display();
    disp.init();

    data = new Data();
    pipeline = new Pipeline();

    data.loadCollections();
}

window.onload = initialize;