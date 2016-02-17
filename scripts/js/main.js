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
    },
    zeros: function(length, width) { // just initialize a 1D or 2D matrix filled with zeros like in Matlab
        if(!width) {
            return d3.range(length).map(function() { return 0; });
        } else {
            return d3.range(length).map(function() { 
                return d3.range(width).map(function() { return 0; });
            });
        }
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
            console.info(stage.name + ': ' + ((stop - start) / 1000) + 's');
            
            // Go to the next stage
            this.current_stage = this.current_stage + 1;
            this.nextStage();
        }.bind(this), 5);
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

function Counter() {
    this.counts = new d3.map();
}
Counter.prototype = {
    has: function(key) {
        return this.counts.get(key) || false;
    },
    set: function(key, val) {
        this.counts.set(key, val);
    },
    incr: function(key, add) {
        add = add || 1;
        var val = this.counts.get(key) || 0;
        this.counts.set(key, val + add);
    },
    cmpCount: function(a, b) {
        if(a.value == b.value)
            return a.key.localeCompare(b.key);
        return b.value - a.value
    },
    top: function(k) {
        return this.top_nlogn(k);
    },
    top_nk: function(k) { // O(nk)
        k = k || 10; // default 10
        
        var top = d3.range(k).map(function() {
            return {key: "", value: 0};
        })
        var minVal = 0;
        var moreThanMin = 0;
        this.counts.forEach(function(key, val) {
            // If it is bigger than a candidate
            if(minVal < val) {
                if(moreThanMin >= k - 1)
                    top = top.filter(function(d) { return d.value > minVal});
                top.push({
                    key: key,
                    value: val
                });
                minVal = d3.min(top, function(d) { return d.value});
                moreThanMin = top.filter(function(d) { return d.value > minVal}).length;
            } else if(minVal == val) {
                top.push({
                    key: key,
                    value: val
                });
            }
        });
        
        return this.firstK(this.getSorted(top), k)
    },
    top_nlogn: function(k) { // O(nlogn)
        k |= 10; // default 10
        
        return this.firstK(this.getSorted(), k);
    },
    stopwords: ['the', 'a', 'an', 'that', 'this',
                'rt', 
                'in', 'on', 'to', 'of', 'at', 'for', 'with', 'about',
                'is', 'are', 'be', 'was', 'have', 'has',
                'i', 'you', 'he', 'she', 'it', 'we', 'they',
                'me', 'him', 'her', 'us', 'them', 
                'my', 'your', 'his', 'its', 'our', 'their',
                'and', 'or',
                'as', 'if', 'so'],
    top_no_stopwords: function(k) {
        k |= 10; // default 10
        var entries = this.counts.entries().filter(function(d) {
            return !this.stopwords.includes(d.key);
        }, this);
        return this.firstK(this.getSorted(entries), k)
    },
    getSorted: function(arr) {
        if(!arr)
            arr = this.counts.entries();
        arr.sort(this.cmpCount)
        return arr;
    },
    firstK: function(arr, k) {
        if(!arr)
            arr = this.counts.entries();
        k |= 10; // default 10
        k = Math.min(k, arr.length);
        
        var res = [];
        for(var i = 0; i < k; i++)
            res.push(arr[i]);
        return res;
    },
    purgeBelow: function(minimum, add_rare) { 
        if(minimum) {
            var self = this;
            this.counts.forEach(function(key, val) {
                if(val < minimum) {
                    this.remove(key);
                    if(add_rare)
                        self.incr("_rare_", val);
                }
            });
        } else { // Halves the size of the array
            var sorted = this.getSorted();
            minimum = sorted[sorted.length / 2].value + 1;

            sorted.forEach(function(entry) {
                if(entry.value < minimum) {
                    this.counts.remove(entry.key);
                    if(add_rare)
                        this.incr("_rare_", entry.value);
                }
            }, this);
        }
    }
};

if(!window.location.href.includes('html')) { // only for the main page
    function initialize() {
        options = new Options();
        options.init();

        disp = new Display();
        disp.init();

        data = new Data();
        pipeline = new Pipeline();

        data.loadCollections();
    }
    
    window.onload = initialize;
}


