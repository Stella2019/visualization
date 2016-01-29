// Structure that will be used throughout the other data
var options, legend, disp, data, pipeline;

var util = {
    formatDate: d3.time.format("%Y-%m-%d %H:%M:%S"),
    date2monthstr: d3.time.format("%Y-%m"),
    date: function(str) {
        return util.formatDate.parse(str);
    },
    simplify: function(str) {
        return "l" + str.replace(/\W/g, '_');
    },
    compareCollections: function(a, b) {
        return util.compareDates(new Date(a.StartTime), new Date(b.StartTime));
    },
    compareSeries: function(a, b) {
        if(a.sum !== undefined && b.sum !== undefined)
            return b.sum - a.sum;
        return a.order - b.order;
    },
    compareDates: function(a, b) {
        if(a < b) 
            return -1;
        if(a > b)
            return 1;
        return 0;
    },
    lunique: function(list) {
        return Array.from(new Set(list)).sort();
    },
    range: function(length) {
        var arr = [];
        for(var i = 0; i < length; i++) {
            arr.push(i);
        }
        return arr;
    }
}

function Pipeline() {
    this.progress = null;
    this.current_stage = -1;
    
    this.stages = [{ // parseCSVData / Load Collection
        name: 'Parse Loaded Collection Data',
        callback: data.parseLoadedCollectionData
    },{
        name: 'Reset Plot Area',
        callback: disp.resetPlotArea
    },{
        name: 'Initialize Series Data',
        callback: data.initializeSeries
    },{ // Prepare Data
        name: 'Calculate Category Totals', 
        callback: data.calculateCategoryTotals
    },{
        name: 'Calculate Time Totals',
        callback: data.calculateTimeTotals
    },{
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
            stage.callback();

            // Go to the next stage
            this.current_stage = this.current_stage + 1;
            this.nextStage();
        }.bind(this), 300);
    },
    abort: function() {
        this.progress.end();
        this.current_stage = -1;
    },
    finish: function() {
        this.progress.end();
        this.current_stage = 0;
    }
};

window.onload = initialize;

function initialize() {
    options = new Options();
    options.init();
    
    disp = new Display();
    disp.init();
    
    data = new Data();
    pipeline = new Pipeline();
    
    data.loadCollections();
}

