using System;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public partial class Hud
    {
        VisualElement townPrompt, townTraining, townRace, townTrainingFill;
        Label townPromptText, townTrainingText, townRaceText;

        void BuildTownActivityHud()
        {
            townPrompt = Box(root, "townActivityPrompt");
            Abs(townPrompt);
            townPrompt.style.translate = new Translate(Length.Percent(-50), Length.Percent(-100));
            StyleTownPlate(townPrompt, "#78aeb3");
            townPromptText = TownText(townPrompt, 14, "#e7ffff");

            townTraining = Box(root, "townTraining");
            Abs(townTraining);
            townTraining.style.translate = new Translate(Length.Percent(-50), Length.Percent(-100));
            StyleTownPlate(townTraining, "#e5b775");
            townTrainingText = TownText(townTraining, 14, "#f8e8bc");
            var track = Box(townTraining);
            track.style.height = 3;
            track.style.marginTop = 4;
            track.style.backgroundColor = C("#1e1731");
            townTrainingFill = Box(track);
            townTrainingFill.style.height = Length.Percent(100);
            townTrainingFill.style.backgroundColor = C("#eab66a");

            townRace = Box(root, "townRace");
            Abs(townRace, null, 101, 16);
            StyleTownPlate(townRace, "#d6a85e");
            townRaceText = TownText(townRace, 17, "#ffdf90");
        }

        static void StyleTownPlate(VisualElement box, string stroke)
        {
            box.pickingMode = PickingMode.Ignore;
            box.style.backgroundColor = C("#19152c", 0.92f);
            box.style.paddingLeft = box.style.paddingRight = 9;
            box.style.paddingTop = box.style.paddingBottom = 5;
            Border(box, 1, C(stroke));
            Round(box, 3);
            box.style.display = DisplayStyle.None;
        }

        static Label TownText(VisualElement parent, int size, string color)
        {
            var text = Text(parent, "", size, color, true);
            text.style.whiteSpace = WhiteSpace.NoWrap;
            text.style.unityTextAlign = TextAnchor.MiddleCenter;
            text.pickingMode = PickingMode.Ignore;
            return text;
        }

        void UpdateTownActivityHud(Game g)
        {
            var activity = g.NearNow;
            bool show = g.Town && !g.TownBusy && !talking && CanvasToScreen != null && root.panel != null;
            bool found = show && activity?.Place == "town-activity";
            townPrompt.style.display = found ? DisplayStyle.Flex : DisplayStyle.None;
            if (found)
            {
                townPromptText.text = activity.Id == "mail" && g.TownUnreadLetters > 0
                    ? $"{(Touch ? "互動" : "F")}　{activity.Name}・{g.TownUnreadLetters} 封新信"
                    : $"{(Touch ? "互動" : "F")}　{activity.Name}";
                PinTownPlate(townPrompt, g, activity.X, (activity.FootY ?? TownArt.FLOOR) - (activity.Hgt ?? 25) - 7);
            }

            bool training = show && g.TownTrainingZone;
            townTraining.style.display = training ? DisplayStyle.Flex : DisplayStyle.None;
            if (training)
            {
                townTrainingText.text = g.ShowTownTrainingResult
                    ? $"{g.TownTrainingDamage:0} 傷害　{g.TownTrainingDps:0.0} DPS　{(g.TownTrainingDone ? "完成" : $"{g.TownTrainingTime:0.0}s")}"
                    : $"練習木樁　{(Touch ? "點攻擊" : "J 攻擊")}";
                townTrainingFill.style.width = Length.Percent((float)Mathf.Clamp01((float)g.TownTrainingTime / 10) * 100);
                PinTownPlate(townTraining, g, g.TownDummyX, TownArt.FLOOR - 64);
            }

            double? elapsed = g.TownRaceClock;
            bool racing = g.Town && !talking && !g.TownBusy && (elapsed.HasValue || g.TownRaceResult != null);
            townRace.style.display = racing ? DisplayStyle.Flex : DisplayStyle.None;
            if (racing)
            {
                townRaceText.text = elapsed is double seconds
                    ? seconds < 0 ? $"準備出發　{Math.Max(1, Math.Ceiling(-seconds))}" : $"攀爬計時　{seconds:0.00} 秒"
                    : g.TownRaceResult;
            }
        }

        void PinTownPlate(VisualElement element, Game game, double x, double y)
        {
            var position = ToPanel(x - game.DisplayCamera.OriginX, y - game.DisplayCamera.OriginY);
            float half = Math.Max(56, element.layout.width * 0.5f);
            if (float.IsNaN(half)) half = 56;
            float width = root.layout.width;
            element.style.left = Mathf.Clamp(position.x, half + 5, Math.Max(half + 5, width - half - 5));
            element.style.top = Math.Max(42, position.y);
        }
    }
}
