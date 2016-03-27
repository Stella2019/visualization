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
        triggers.on('alert', this.alert);
    },
    buildPage: function() {
        var body = d3.select('body')
            .append('div')
            .attr('class', 'container')
            .attr('id', 'body')
            .style('padding-right', '200px');
        
        body.append('div')
            .attr('id', 'header')
            .attr('class', 'text-center')
            .append('span')
            .attr('id', 'chart-title')
            .html('Twitter Capture Visualization');
        
        var chart_area = body.append('div')
            .attr('id', 'charts')
            .style('width', '1000px');
        
        chart_area.append('div')
            .attr('id', 'timeseries_div')
            .append('svg')
            .attr('id', 'timeseries');
        
        chart_area.append('div')
            .attr('id', 'chart-bottom')
            .attr('class', 'text-center')
            .append('div')
            .style('padding', '10px')
            .html('Tweet volume over the whole collection period. Manually enter or brush over to focus on time.');
        
        triggers.emit('page_built');
    },
    setTitle: function(event) {
         d3.select('#chart-title')
            .html('<small>' + event.Type + ':</small> ' + 
                  event.DisplayName);
    },
    alert: function(ops) {
        // Manage options
        if(typeof(ops) == 'string'){
            ops = {text: ops};
        }
        if(!ops['style_class']) {
            ops['style_class'] = 'warning';
        }
        if(!ops['parent']) {
            ops['parent'] = '#body';
        }
        
        var style = {
            position: 'absolute',
            top: '50%',
            transform: 'translate(0%, -50%)',
            left: '20%',
            width: '60%',
            'z-index': 4
        }
        
        var alert_shadow = d3.select(ops['parent']).append('div')
            .attr('class', 'alert_outer')
            .style({
                'width': '100%',
                'height': '100%',
                'position': 'absolute',
                'top': 0,
                'left': 0
            })
            .on('click', function() {
                d3.select('.alert_outer').remove();
            });
        
        var alert_div = alert_shadow.append('div')
            .attr({
                'class': 'alert alert-' + ops['style_class'] + ' alert-dismissible',
                'role': 'alert'
            })
            .style(style);
        
        alert_div.append('button')
            .attr({'type': 'button',
                   'class': 'close', 
                   'data-dismiss': 'alert',
                   'aria-label': 'Close'})
            .append('span')
            .attr('aria-hidden', 'true')
            .html('&times;');
        
        alert_div.append('span')
            .html(ops['text']);
    }
}