import "./loading-spinner.scss";
import LoadingSpinnerTemplate from "./loading-spinner.html?raw"
import {Component} from "@slyce.dev/ridr";

export class LoadingSpinner extends Component {
    // noinspection JSAnnotator
    static template = LoadingSpinnerTemplate;
}
