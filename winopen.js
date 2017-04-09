
let b1 = document.getElementById("b1");
let bp = document.getElementById("bp");
let b2 = document.getElementById("b2");
b2.style.display = "none";

b1.onclick = (ev => {
    let win = window.open('opened.html');
});

function showb2(){
    return new Promise(resolve => {
        b2.style.display = "block";
        b2.onclick = (ev => resolve(true));
    });
}

async function setup(){
    bp.onclick = (async (ev) => {
        let clicked = await showb2();
        if(clicked){
            let win = window.open('opened.html');
        }
    });   
}

setup();
