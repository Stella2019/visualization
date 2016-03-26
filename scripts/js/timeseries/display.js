function TimeseriesDisplay(app) {
    this.app = app;
}

TimeseriesDisplay.prototype = {
    setTriggers: function() {
        triggers.on('new_event', this.setTitle);
    },
    buildPage: function() {
        var body = d3.select('body')
            .append('div')
            .attr('class', 'container')
            .attr('id', 'body');
        
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
            .attr('id', 'legend');
        
        chart_area.append('div')
            .attr('id', 'chart-bottom')
            .attr('class', 'text-center')
            .append('div')
            .style('padding', '10px')
            .html('Tweet volume over the whole collection period. Manually enter or brush over to focus on time.');
        
        // Modal
        var modal = d3.select('body')
            .append('div')
            .attr({
                class: 'modal fade',
                id: 'modal',
                tabindex: '-1',
                role: 'dialog',
                'aria-labelledby': 'modal'
            })
            .append('div')
            .attr({
                class: 'modal-dialog',
                role: 'document'
            })
            .append('div')
            .attr('class', 'modal-content');
        
        var modal_header = modal.append('div')
            .attr('class', 'modal-header');
        
        modal_header.append('button')
            .attr({
                type: 'button',
                class: 'close',
                'data-dismiss': 'modal',
                'aria-label': 'Close'
            })
            .append('span')
            .attr('aria-hidden', 'true')
            .html('&times;');
        
        modal_header.append('h4')
            .attr({
                class: 'modal-title',
                id: 'modalLabel'
            })
            .html('Modal title');
        
        modal.append('div')
            .attr('class', 'modal-body');
        
        var modal_footer = modal.append('div')
            .attr('class', 'modal-footer');
        
        modal_footer.append('div')
            .attr('modal-options');
        
        modal_footer.append('button')
            .attr({
                type: 'button',
                class: 'btn btn-default',
                'data-dismiss': 'modal'
            })
            .html('Close');
    },
    setTitle: function(event) {
         d3.select('#chart-title')
            .html('<small>' + event.Type + ':</small> ' + 
                  event.DisplayName);
    }
}