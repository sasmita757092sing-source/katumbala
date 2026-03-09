import Text "mo:core/Text";
import Array "mo:core/Array";
import Order "mo:core/Order";
import List "mo:core/List";
import Runtime "mo:core/Runtime";

actor {
  type ScoreEntry = {
    name : Text;
    score : Nat;
  };

  module ScoreEntry {
    public func compare(a : ScoreEntry, b : ScoreEntry) : Order.Order {
      Nat.compare(b.score, a.score);
    };
  };

  var highScore : Nat = 0;
  var highScoreName : Text = "";
  let scores = List.empty<ScoreEntry>();

  public shared ({ caller }) func submitScore(name : Text, score : Nat) : async () {
    if (score > highScore) {
      highScore := score;
      highScoreName := name;
    };

    let newEntry : ScoreEntry = {
      name;
      score;
    };
    scores.add(newEntry);

    let allScores = scores.toArray().sort();

    let topScores = if (allScores.size() > 10) {
      allScores.sliceToArray(0, 10);
    } else {
      allScores;
    };

    scores.clear();
    scores.addAll(topScores.values());
  };

  public query ({ caller }) func getHighScore() : async (Nat, Text) {
    (highScore, highScoreName);
  };

  public query ({ caller }) func getTopScores() : async [ScoreEntry] {
    scores.toArray();
  };

  public query ({ caller }) func getLeaderboardEntry(position : Nat) : async ScoreEntry {
    if (position <= 0 or position > 10) {
      Runtime.trap("Position must be between 1 and 10");
    };

    let currentScores = scores.toArray();
    if (position > currentScores.size()) {
      Runtime.trap("Not enough scores available");
    };

    currentScores[position - 1];
  };
};
