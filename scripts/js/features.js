var FD;

function FeatureDistribution() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.modal = new Modal(this);
    this.tooltip = new Tooltip();
    this.dataset = new CollectionManager(this, {name: 'Dataset', flag_subset_menu: true});
//    this.cmp = new CollectionManager(this, 'Comparison');
    
    this.event = {};
    this.subset = {};
}
FeatureDistribution.prototype = {
    init: function() {
        this.setTriggers();
        this.buildPage();
        this.setOptions();
        
        this.tooltip.init();
        triggers.emit('modal:build');
        triggers.emit('collectionManager:build');
//        this.getEventData();
    },
    setTriggers: function() {
    },
    buildPage: function() {
        
    },
    setOptions: function() {
        this.ops.panels = ['Dataset', 'Display', 'Comparison'];
        
        this.ops['Dataset'] = {};
        this.ops['Display'] = {};
        this.ops['Comparison'] = {};
        
        this.ops.init();
    },
};

function initialize() {
    FD = new FeatureDistribution();
    
    FD.init();
}
window.onload = initialize;