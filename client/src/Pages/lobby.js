import React from 'react';
import Game from './game';
import io from 'socket.io-client';

class Lobby extends React.Component {
  constructor(props) {
    super(props);
    let params = new URLSearchParams(window.location.search);
    this.roomId = params.get('id');
    let id = document.cookie.match('(^|;) ?' + 'id' + '=([^;]*)(;|$)');
    id = id ? id[2] : null;
    this.state = {players: [], roomOwner: false, phase: 'lobby', clientUserId: id};
    this.state.lobbyState = window.sessionStorage.getItem('nickname-'+this.roomId) ? 'lobby' : 'no nickname';
    this.joinGame = this.joinGame.bind(this);
    this.startGame = this.startGame.bind(this);
    this.kickPlayer = this.kickPlayer.bind(this);
    this.copyLink = this.copyLink.bind(this);
    this.getDecks = this.getDecks.bind(this);

    // TODO: read this from some config file so when we deploy on heroku we don't have to change it each time
    console.log("env:", process.env, "URL:", process.env.URL)
    this.lobby = io.connect(process.env.REACT_APP_URL+this.roomId);
    this.lobby.on('room full', () => {
      // TODO: room is full
    });
    this.lobby.on('player list', (players) => {
      console.log("list of players")
      console.log(players)
      let roomOwner = this.state.roomOwner;
      this.setState({players: players.map((player) => {return player.username}), roomOwner: players[0].socketId === this.socketId ? true : false});
      if (!roomOwner && this.state.roomOwner) {
        this.getDecks();
      }
    });
    this.lobby.on('start game', (gameState) => {
      this.setState({lobbyState: "game started"});
      console.log(`start game, initial cards: ${gameState.private.cards}`)
    });
    // TODO: Give a default username on connect if none
    let username = window.sessionStorage.getItem('nickname-'+this.roomId);
    if (username) {
      this.state.username = username;
      this.lobby.emit('join', username, (socketId) => {
        this.socketId = socketId;
      });
    }
  }

  startGame() {
    this.lobby.emit('start game');
  }

  kickPlayer(username) {
    // Disconnect player with given username
  }

  copyLink() {
    // copy link to clipboard
  }

  joinGame() {
    let nickname = document.getElementById('nickname').value;
    nickname = nickname || Math.random().toString(36).slice(2);; //TODO real random name
    window.sessionStorage.setItem('nickname-'+this.roomId, nickname);
    this.setState({lobbyState: "lobby", username: nickname});
    this.lobby.emit('join', nickname, (socketId) => {
      this.socketId = socketId;
    });
  }

  getDecks() {
    if (this.state.clientUserId) {
      fetch('/api/user/' + this.state.clientUserId + '/decks/', {
        method: "GET"
      }).then(response => {
        if (!response.ok) throw Error(response);
        return response
      }).then(response => {
        return response.json();
      }).then (decks => {
        console.log("decks from call: ", decks);
        this.setState({decks: decks});
      }).catch(err => console.log("err fetching decks", err));
    }
  }

  render() {
    let players = this.state.players.map((username) => {
      return (
          <div className="w-75">
            <li className="list-group-item ml-3">
            {this.state.roomOwner && <button type="button" className="btn btn-danger mr-3" onClick={this.kickPlayer(username)}> X </button>}
            {username}
            </li>
          </div>
      )
    });
    let host = this.state.roomOwner ? "You" : this.state.players[0];
    let game;
    let lobby;
    const MAXIMUM_SELECTABLE_POINTS = 9;
    const DEFAULT_POINTS = 5;
    let pointsOptions = [...Array(MAXIMUM_SELECTABLE_POINTS).keys()].map((value) => {
      if (value + 1 === DEFAULT_POINTS)
        return (<option value={value + 1} selected="selected"> {value + 1} </option>);
      else
        return (<option value={value + 1}> {value + 1} </option>);
    });
    let defaultDeck = (<option value="default"> Default Deck </option>);
    let whiteDeckOptions = [defaultDeck];
    let blackDeckOptions = [defaultDeck];
    if (this.state.decks) {
      for (let deck of this.state.decks) {
        let deckOption = <option value={deck._id}> {deck.name} </option>;
        deck.type === "WHITE" ? whiteDeckOptions.push(deckOption) : blackDeckOptions.push(deckOption);
      }
    }
    let settingsBlock
    if (this.state.roomOwner) {
      settingsBlock = (
        <div id="settings">
          <h3> Settings: </h3>
            <label for="pointSelect" className="m-1"> Points to win: </label>
            <select id="points">
              {pointsOptions}
            </select>

            <br/>

            <label for="whiteDeckSelect" className="m-1"> White deck: </label>
            <select id="whiteDeckSelect">
              {whiteDeckOptions}
            </select>

            <br/>

            <label for="blackDeckSelect" className="m-1"> Black Deck: </label>
            <select id="blackDeckSelect">
              {blackDeckOptions}
            </select>

          </div>
        )
    }


    switch (this.state.lobbyState) {
      case "no nickname": lobby = (
        <div id="main-container" className="d-flex flex-column justify-content-center align-items-center p-2">
          <h1> Shuffle With Friends </h1>
          <span>
            Nickname:
            <input id="nickname" className="ml-2"></input>
          </span>
          If you don't choose one we'll make one for you
          <span>
            <button type="button" className="btn btn-primary m-3" onClick={this.joinGame}>Join Game</button>
          </span>
        </div>);
        break;
        // Copy link
        // Kick (for host)
        // Settings
      case "lobby": lobby = (
          <div>
            <h1> Shuffle With Friends </h1>
            <h2> Players: </h2>
            <div className="w-25"> <ul className="list-group"> {players} </ul> </div>
            <br/>
            <h3> Host: {host} </h3>
            <br/>
            {settingsBlock}
            <br/>
            <button type="button" className="btn btn-primary mr-3" onClick={this.copyLink}>Copy Link</button>
            {
              this.state.roomOwner &&
              <button type="button" className="btn btn-success" onClick={this.startGame}>Start Game</button>
            }
          </div>
        );
        break;
      case "game started":
        game = (<Game lobby={this.lobby} socketId={this.socketId}></Game>);
        break;
      default: break;
    }

    return(
      <div className="w-100 h-100">
        {lobby}
        <canvas id="gameCanvas" resize="true"></canvas>
        {game}
      </div>
    )
  }
}

export default Lobby;
