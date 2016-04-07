function Modal(app) {
    this.app = app;
    
    this.id = 'modal_r' + Math.floor(Math.random() * 1000000 + 1);
    this.container = {};
    this.header = {};
    this.body = {};
    this.footer = {};
    this.options = {};
    
    this.init();
}

Modal.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('modal:build', this.buildModal.bind(this));
        triggers.on('modal:reset', this.reset.bind(this));
        triggers.on('modal:open', this.open.bind(this));
        triggers.on('modal:close', this.close.bind(this));
        triggers.on('modal:title', this.setTitle.bind(this));
    },
    buildModal: function() {        
        this.container = d3.select('body')
            .append('div')
            .attr({
                class: 'modal fade',
                id: this.id,
                tabindex: '-1',
                role: 'dialog',
                'aria-labelledby': 'modal'
            });
        
        var content = this.container.append('div')
            .attr({
                class: 'modal-dialog',
                role: 'document'
            })
            .append('div')
            .attr('class', 'modal-content');
        
        this.header = content.append('div')
            .attr('class', 'modal-header');
        
        this.header.append('button')
            .attr({
                type: 'button',
                class: 'close',
                'data-dismiss': 'modal',
                'aria-label': 'Close'
            })
            .append('span')
            .attr('aria-hidden', 'true')
            .html('&times;');
        
         this.title = this.header.append('h4')
            .attr({
                class: 'modal-title',
                id: 'modalLabel'
            })
            .html('Modal title');
        
        this.body = content.append('div')
            .attr('class', 'modal-body');
        
        this.footer = content.append('div')
            .attr('class', 'modal-footer');
        
        this.options = this.footer.append('div')
            .attr('class', 'modal-options');
        
        this.footer.append('button')
            .attr({
                type: 'button',
                class: 'btn btn-default',
                'data-dismiss': 'modal'
            })
            .html('Close');
    },
    reset: function() {
        this.title.html('');
        this.body.selectAll('*').remove();
        this.options.selectAll('*').remove();
    },
    open: function() {
        $('#' + this.id).modal(true);
    },
    close: function() {
        // TODO
    },
    setTitle: function(data) {
        this.title.html(data);
    }
};

