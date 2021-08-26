import React, { useState, useRef, useEffect } from "react";
import { makeStyles, useTheme } from '@material-ui/core/styles';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Button from '@material-ui/core/Button';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import Typography from '@material-ui/core/Typography';
import Slider from '@material-ui/core/Slider';

import Alert from "react-bootstrap/Alert";
import randomColor from "randomcolor";
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import { Stage, Layer, Line, Text } from "react-konva";
import Grid from "../components/grid";
import { ExportToCsv } from 'export-to-csv';
import people_file from "../data/people.txt";
import locs_file from "../data/locs.txt";
import { csvJSON } from "../utils/files";
import { strip_text } from "../utils/files";
function ProbDensePage() {
    const classes = useStyles();
    const [initialLoad, setInitialLoad] = useState(true);
    const stageEl = React.createRef();
    const layerEl = React.createRef();
    const csvLink = React.createRef();
    const getRandomInt = max => {
        return Math.floor(Math.random() * Math.floor(max));
    };

    var canvas_width = 1500;
    var canvas_height = 600;

    const [gs_y, setGSY] = useState(500);
    const [gs_x, setGSX] = useState(60);
    var x_axis_distance_grid_lines = (canvas_height - 50) / gs_y;
    var y_axis_distance_grid_lines = 0.5 / (gs_x / 60);

    const [mode, setMode] = useState("p_go");

    const [selectedLines, setSelectedLines] = useState([]);
    const [highlightedLines, setHighlightedLines] = useState([]);
    const [selectedPerson, setSelectedPerson] = useState(0);
    const [selectedLoc, setSelectedLoc] = useState(0);
    const [allData, setAllData] = useState({});

    const [isDown, setIsDown] = useState(false);
    const [consoleText, setConsoleText] = useState("HSW");
    const [lines, setLines] = useState([]);
    // const lines = useRef([]);

    const [prevX, setprevX] = useState(0);
    const [prevY, setprevY] = useState(0);
    const [posx, setposx] = useState(0);
    const [posy, setposy] = useState(0);

    const [people, setpeople] = useState([]);
    const [locs, setlocs] = useState(['_home', '_w_home', '_work']);

    const columns = [{ Header: 'person', accessor: 'person' }, { Header: 'location', accessor: 'location' }]
    for (let time = 0; time < 60 * 24; time++) {
        columns.push({ Header: time.toString(), accessor: time.toString() })
    }


    const convertpx2x = function (px) {
        return (px - (y_axis_distance_grid_lines * gs_x) - posx) / gs_x;
    }
    const convertpy2y = function (py) {
        return -(py - (x_axis_distance_grid_lines * gs_y) - posy) / gs_y;
    }
    const convertx2px = function (x) {
        return (x * gs_x) + (y_axis_distance_grid_lines * gs_x)
    }
    const converty2py = function (y) {
        return -(y * gs_y) + (x_axis_distance_grid_lines * gs_y)
    }


    useEffect(() => {

        console.log("Initializing Prob page")
        console.log("loading people, location classes");

        fetch(locs_file)
            .then(r => r.text())
            .then(text => {
                let arr = text.split('\n');
                arr.forEach(element => {
                    if (element.length > 0) {
                        if (locs.indexOf(strip_text(element)) == -1)
                            addLoc(element);
                    }
                });
            }).then(() => {
                fetch(people_file)
                    .then(r => r.text())
                    .then(text => {
                        console.log('text decoded:', text.split('\n'));
                        let arr = text.split('\n');
                        arr.forEach(element => {
                            if (element.length > 0) {
                                if (people.indexOf(strip_text(element)) == -1)
                                    addPerson(element);
                            }
                        });
                    }).then(() => {
                        console.log(locs)
                        for (let i = 0; i < people.length; i++) {
                            for (let j = 0; j < locs.length; j++) {
                                console.log("Initializing array for ", people[i], locs[j], i, j)
                                allData[[i, j]] = Array(24 * 60).fill(0);
                            }
                        }
                    });
            })


        // window.onscroll = () => {
        //     posx = Math.round(stageEl.current.getContainer().getBoundingClientRect().left * 1000) / 1000;
        //     posy = Math.round(stageEl.current.getContainer().getBoundingClientRect().top * 1000) / 1000;
        // }
    }, [initialLoad])

    useEffect(() => {
        if (mode == 'p_go') {
            setGSY(500)
            setGSX(60)
        } else if (mode == 'p_dt') {
            setGSY(500)
            setGSX(600)
        }



    }, [mode])

    useEffect(() => {
        let ps = []
        let ls = [];
        while (lines.length > 0) {
            ps.push(lines[0].key[0]);
            ls.push(lines[0].key[1]);
            removeLine(lines[0].key.toString());
        }
        for (let i=0;i<ps.length;i++){
            addLine(ps[i], ls[i])
        }


    }, [gs_x, gs_y])


    function findxy(res, e) {

        if (res == 'down') {
            setIsDown(true)
            var coordx = convertpx2x(e.evt.clientX);
            var coordy = convertpy2y(e.evt.clientY);
            setprevX(coordx);
            setprevY(coordy);
            // update(coordx, coordy);
        }
        if (res == 'up' || res == "out") {
            setIsDown(false)
            lines.forEach(element => {
                allData[element.key] = element.values;
            });
        }
        if (res == 'move') {
            setposx(Math.round(stageEl.current.getContainer().getBoundingClientRect().left * 1000) / 1000);
            setposy(Math.round(stageEl.current.getContainer().getBoundingClientRect().top * 1000) / 1000);
            var _consoleText = "pX=" + e.evt.clientX + " pY=" + e.evt.clientY + " X=" + convertpx2x(e.evt.clientX) + " Y=" + convertpy2y(e.evt.clientY) + "\n";
            _consoleText += "posX=" + posx + " posY=" + posy
            _consoleText += "pX'=" + convertx2px(convertpx2x(e.evt.clientX)) + " pY'=" + converty2py(convertpy2y(e.evt.clientY))
            setConsoleText(_consoleText);
            // console.log(res, isDown)
            if (isDown) {

                var coordx = convertpx2x(e.evt.clientX);
                var coordy = convertpy2y(e.evt.clientY);
                update(coordx, coordy);
                setprevX(coordx);
                setprevY(coordy);


            }
        }
    }

    function update(x, y) {
        var x1 = Math.floor(prevX * 60);
        var x2 = Math.floor(x * 60);
        for (let l_idx = 0; l_idx < highlightedLines.length; l_idx++) {
            var _line;
            var _val;
            let p_idx = 0;
            for (p_idx = 0; p_idx < lines.length; p_idx++) {
                if (lines[p_idx].key == highlightedLines[l_idx]) {
                    _line = lines[p_idx].points
                    _val = lines[p_idx].values
                    break
                }
            }
            if (_line == undefined) {
                console.log("ERROR");
            }
            // console.log(x, y, x1, x2, lines[p_idx])
            for (var i = x1; i <= x2; i++) {
                var _y;
                if (x1==x2){
                    _y = y;
                }else{
                    _y = prevY + (y - prevY) * (i - x1) / (x2 - x1);
                }
                
                _y = Math.min(_y, 1);
                _y = Math.max(_y, 0);
                _line[2 * i + 1] = converty2py(_y);
                _val[i] = _y;
                if (isNaN(_line[2 * i + 1])) {
                    _line[2 * i + 1] = 0;
                }

            }
            for (var i = x2; i <= x1; i++) {
                var _y;
                if (x1==x2){
                    _y = y;
                }else{
                    _y = prevY + (y - prevY) * (i - x1) / (x2 - x1);
                }
                _y = Math.min(_y, 1);
                _y = Math.max(_y, 0);
                _line[2 * i + 1] = converty2py(_y);
                _val[i] = _y;
                if (isNaN(_line[2 * i + 1])) {
                    _line[2 * i + 1] = 0;
                }

            }
            lines[p_idx].values = _val;
            stageEl.current.children[1].children[p_idx].setPoints(_line);
        }
    }
    function init_line(p, l, data) {
        console.log("Initializing line for " + p + " " + l)
        var _line = Array(24 * 60 * 2).fill(0);
        for (var i = 0; i < 24 * 60; i++) {
            _line[i * 2] = convertx2px(i / 60);
            _line[i * 2 + 1] = converty2py(data[i])
        }
        let to_add = {
            points: _line,
            stroke: randomColor(),
            strokeWidth: 5,
            lineCap: 'round',
            lineJoin: 'round',
            key: [p, l],
            values: data,
        };
        return to_add;

    }
    function addLine(p, l) {
        if (p == undefined || l == undefined) {
            console.log("Person or location not selected")
            return
        }
        console.log("Adding line ", p, l, people[p], locs[l]);
        for (var i = 0; i < selectedLines.length; i++) {
            if (selectedLines[i][0] == p && selectedLines[i][1] == l) {
                console.log("Exists")
                return
            }
        }
        selectedLines.push([p, l]);
        if (allData.hasOwnProperty([p, l]) && allData[[p, l]] != undefined) {
            const line = init_line(p, l, allData[[p, l]]);
            var _lines = lines;
            for (let i = 0; i < lines.length; i++) {
                if (lines.key == [p, l]) {
                    _lines[i] = line;
                }
            }
            _lines.push(line);
            setLines(_lines);
        } else {
            console.log("ERROR");
            return
        }
        console.log("Added line ", people[p], locs[l]);
    }

    function removeLine(pl_key) {
        console.log("removing line " + pl_key)
        let _selectedLines = selectedLines;
        let _lines = lines;
        let _highlightedLines = highlightedLines;

        for (let j = 0; j < selectedLines.length; j++) {
            if (_selectedLines[j] == pl_key) {
                _selectedLines.splice(j, 1);
            }
        }
        for (let j = 0; j < lines.length; j++) {
            if (_lines[j].key == pl_key) {
                _lines.splice(j, 1);
            }
        }
        for (let j = 0; j < highlightedLines.length; j++) {
            if (_highlightedLines[j] == pl_key) {
                _highlightedLines.splice(j, 1);
            }
        }
        setSelectedLines(_selectedLines)
        setHighlightedLines(_highlightedLines)
        setLines(_lines)

    }

    function addLoc(element) {
        element = strip_text(element)
        if (element == 'Cemetery') {
            return;
        }
        locs.push(element);
        setlocs(locs.sort(function (a, b) {
            return a.localeCompare(b);
        }));

    }

    function addPerson(element) {
        element = strip_text(element)
        people.push(element);
        setpeople(people.sort(function (a, b) {
            return a.localeCompare(b);
        }))
    }

    const handleModeChange = function (e) {
        setMode(e.target.value);
    }

    const handlePersonClick = function (e, id) {
        setSelectedPerson(id);
    }

    const handleLocClick = function (id, e) {
        setSelectedLoc(id);
        addLine(selectedPerson, id)
    }

    const handleAddAllLocsClick = (event) => {

        for (let i = 0; i < locs.length; i += 1) {
            addLine(selectedPerson, i);
        }
    };


    const handleAddAllPeopleClick = (event) => {

        for (let i = 0; i < people.length; i += 1) {
            addLine(i, selectedLoc);
        }
    };

    const handleSelectedListClick = (event) => {
        const { options } = event.target;
        const value = [];
        for (let i = 0, l = options.length; i < l; i += 1) {
            if (options[i].selected) {
                value.push(options[i].value);
            }
        }
        setHighlightedLines(value);
    };

    const handleRemoveClick = (event) => {
        while (highlightedLines.length > 0) {
            removeLine(highlightedLines[0]);
        }
    };

    const handleSaveClick = (event) => {
        const options = {
            filename: mode + 'LocPersonTime',
            fieldSeparator: ',',
            quoteStrings: '',
            decimalSeparator: '.',
            showLabels: true,
            showTitle: false,
            useTextFile: false,
            useBom: true,
            useKeysAsHeaders: true,
            // headers: ['Column 1', 'Column 2', etc...] <-- Won't work with useKeysAsHeaders present!
        };


        var data_to_download = []
        for (let p = 0; p < people.length; p++) {
            for (let l = 0; l < locs.length; l++) {
                let record_to_download = { 'person': people[p], 'location': locs[l] }
                for (var t = 0; t < allData[[p, l]].length; t++) {
                    record_to_download[t] = allData[[p, l]][t]
                }
                data_to_download.push(record_to_download)
            }


        }
        console.log(data_to_download, csvLink)

        const csvExporter = new ExportToCsv(options);
        csvExporter.generateCsv(data_to_download);

    }
    const handleLoadClick = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            /* Parse data */
            const bstr = evt.target.result;
            //   const wb = XLSX.read(bstr, { type: 'binary' });
            //   /* Get first worksheet */
            //   const wsname = wb.SheetNames[0];
            //   const ws = wb.Sheets[wsname];
            //   /* Convert array of arrays */
            //   const data = XLSX.utils.sheet_to_csv(ws, { header: 1 });
            //   processData(data);
            const data = csvJSON(bstr);
            var _allData = {};
            console.log(data.length, data);
            for (let i = 0; i < data.length; i++) {
                if (data[i]['person'] == undefined || data[i]['location'] == undefined) {
                    continue
                }
                let person = data[i]['person'];
                let location = data[i]['location'];
                let p = people.indexOf(person);
                let l = locs.indexOf(location);
                console.log(data[i]['person'], p, data[i]['location'], l, people, locs)
                if (p == -1) {
                    addPerson(data[i]['person']);
                    p = people.length - 1;
                }
                if (l == -1) {
                    addLoc(data[i]['location']);
                    l = locs.length - 1;
                }

                let arr = [];
                for (let t = 0; t < 60 * 24; t++) {
                    arr.push(parseFloat(data[i][t]));
                }
                _allData[[p, l]] = arr;

                for (let j = 0; j < locs.length; j++) {
                    if (_allData.hasOwnProperty([p, j])) {
                        continue
                    }
                    _allData[[p, j]] = Array(24 * 60).fill(0);
                }
                for (let j = 0; j < people.length; j++) {
                    if (_allData.hasOwnProperty([j, l])) {
                        continue
                    }
                    _allData[[j, l]] = Array(24 * 60).fill(0);
                }
            }
            console.log(_allData);
            setAllData(_allData)
        };
        // reader.readAsBinaryString(file);
        reader.readAsText(file);
    }
    const handleSliderChange = (event, newValue) => {
        setGSX(newValue);
      };

    return (
        <div className="prob-page">
            <FormControl component="fieldset">
                <FormLabel component="legend">Mode</FormLabel>
                <RadioGroup aria-label="mode" name="mode1" value={mode} onChange={handleModeChange}>
                    <FormControlLabel value="p_go" control={<Radio />} label="How likely they will go?" />
                    <FormControlLabel value="p_dt" control={<Radio />} label="How long will they stay?" />
                    {/* <FormControlLabel value="disabled" disabled control={<Radio />} label="(Disabled option)" /> */}
                </RadioGroup>
            </FormControl>
            <Typography id="gs-slider" gutterBottom>
                Temperature
            </Typography>
            <Slider
                onChange={handleSliderChange}
                aria-labelledby="gs-slider"
                valueLabelDisplay="auto"
                step={10}
                marks
                min={60}
                max={600}
            />
            <Stage
                width={canvas_width}
                height={canvas_height}
                ref={stageEl}
                onMouseDown={e => {
                    findxy('down', e);
                }}
                onMouseMove={e => {
                    findxy('move', e);
                }}
                onMouseUp={e => {
                    findxy('up', e);
                }}
                onMouseOut={e => {
                    findxy('out', e);
                }}


            >
                <Grid canvas_width={canvas_width}
                    canvas_height={canvas_height}
                    x_axis_distance_grid_lines={x_axis_distance_grid_lines}
                    y_axis_distance_grid_lines={y_axis_distance_grid_lines}
                    gs_y={gs_y}
                    gs_x={gs_x}
                    convertx2px={convertx2px}
                    converty2py={converty2py} />
                <Layer ref={layerEl}>
                    {lines.map((line, i) => {
                        return (
                            <Line
                                key={i}
                                {...line}
                            />
                        );
                    })}
                </Layer>
            </Stage>

            <Alert>
                {consoleText}
            </Alert>

            <h2>Staged lines</h2>
            <FormControl className={classes.formControl}>
                <InputLabel shrink htmlFor="select-multiple-native">
                    Select lines to edit
                </InputLabel>
                <Select
                    multiple
                    native
                    value={highlightedLines}
                    onChange={handleSelectedListClick}

                    inputProps={{
                        id: 'select-multiple-native',
                    }}
                >
                    {selectedLines.map((element) => (
                        <option key={people[element[0]] + "-" + locs[element[1]]} value={element}>
                            {people[element[0]] + "-" + locs[element[1]]}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <Button variant="contained" onClick={(e) => handleRemoveClick(e)}>Remove</Button>
            <Button variant="contained" onClick={(e) => handleSaveClick(e)}>Save</Button>
            <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleLoadClick}
            />

            <h2>People</h2>
            <ToggleButtonGroup
                value={selectedPerson}
                exclusive
                onChange={handlePersonClick}
                aria-label="text alignment"
                flexWrap="wrap"
            >
                {people.map((bt, i) => {
                    return (<ToggleButton variant="contained" key={i} value={i}>{bt}</ToggleButton>)
                })}

            </ToggleButtonGroup>
            <br></br>
            <Button variant="contained" onClick={(e) => handleAddAllLocsClick(e)}>Add all locations for {people[selectedPerson]}</Button>


            <h2>Location</h2>
            <ButtonGroup variant="contained" color="primary" aria-label="text primary button group" flexWrap="wrap" orientation='vertical'>
                {locs.map((bt, i) => {
                    return (<Button variant="contained" key={i} onClick={(e) => handleLocClick(i, e)}>{bt}</Button>)
                })}
            </ButtonGroup>
            <br></br>
            <Button variant="contained" onClick={(e) => handleAddAllPeopleClick(e)}>Add all people in {locs[selectedLoc]}</Button>



            {/* <Button variant="contained" onClick={(e) => handleLoadClick(e)} accept="file">Load</Button> */}


        </div>
    );
}


const useStyles = makeStyles((theme) => ({
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
        maxWidth: 300,
    },
    chips: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    chip: {
        margin: 2,
    },
    noLabel: {
        marginTop: theme.spacing(3),
    },
}));

export default ProbDensePage;