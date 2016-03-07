



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