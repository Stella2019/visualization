// Structure that will be used throughout the other data
var options, legend, disp, data;

var util = {
    formatDate: d3.time.format("%Y-%m-%d %H:%M:%S"),
    simplify: function(str) {
        return "l" + str.replace(/[\s\.#]+/g, '_');
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
    }
}

window.onload = initialize;

function initialize() {
    options = new Options();
    disp = new Display();
    data = new Data();
    
    disp.init();
}

