function TimeseriesView(app) {
    this.app = app;
    
    this.init();
}

TimeseriesView.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event_updated', this.setTitle);
//        triggers.on('page:resize', );
        $(window).on('resize', this.setChartHeights);
    },
    buildPage: function() {
        var body = d3.select('body')
            .append('div')
            .attr('id', 'body');
        
        body.append('div')
            .attr('class', 'header')
            .append('span')
            .attr('id', 'chart-title')
            .html('Twitter Collection Timeseries Visualization');
        
        body.append('div')
            .attr('id', 'timeseries-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'timeseries')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('id', 'context-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'context')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('class', 'ui-bottom footer')
            .append('div')
            .html('Tweet volume over the whole collection period. Manually enter or brush over to focus on time.');
        
        triggers.emit('page_built');
    },
    setTitle: function(event) {
         d3.select('#chart-title')
            .html('<small>' + event.Type + ':</small> ' + 
                  event.Label);
    },
    setChartHeights: function(event) {
        // Get constraints
        var page = window.innerHeight;
        var header = parseInt(d3.select('.header').style('height'));
        var footer = parseInt(d3.select('.footer').style('height'));
        
        // Minimum heights
        var focus = 200;
        var context = 120;
        
        // Fill extra space
        // -10 because of page margins I haven't been able to resolve
        // -30 for the padding on the top & bottom
        var extra_space = page - header - footer - focus - context - 10 - 30;
        if(extra_space > 0) {
            var extra_focus = Math.floor(extra_space * 0.75);
            focus += extra_focus;
            context += extra_space - extra_focus;
        }
        
        // Send an event
        triggers.emit('chart:resize', [focus, context]);
    }
}